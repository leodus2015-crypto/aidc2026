from unittest.mock import MagicMock, patch

import pymysql
import pytest

import db


def test_connection_driver_error_is_wrapped_without_detail():
    with patch.object(db, "database_configured", return_value=True), patch.object(
        db.pymysql,
        "connect",
        side_effect=pymysql.MySQLError("host and credential detail"),
    ):
        with pytest.raises(db.DatabaseError, match="数据库不可用") as exc_info:
            with db.db_connection():
                pass

    assert "credential detail" not in str(exc_info.value)


def test_transaction_driver_error_rolls_back_and_is_wrapped():
    connection = MagicMock()
    with patch.object(db, "database_configured", return_value=True), patch.object(
        db.pymysql,
        "connect",
        return_value=connection,
    ):
        with pytest.raises(db.DatabaseError, match="数据库操作失败"):
            with db.db_connection():
                raise pymysql.MySQLError("query detail")

    connection.rollback.assert_called_once()
    connection.commit.assert_not_called()
    connection.close.assert_called_once()


def _cursor_returning(existing):
    cursor = MagicMock()
    cursor.fetchone.return_value = existing
    cursor.rowcount = 1
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    return connection, cursor


def test_upsert_rejects_stale_expected_version():
    connection, _cursor = _cursor_returning({"version": 4, "config_json": "{}"})

    with patch.object(db, "db_connection") as context:
        context.return_value.__enter__.return_value = connection
        with pytest.raises(db.ConfigConflictError) as exc_info:
            db.upsert_config("roi.defaults", {"computeP": 1}, expected_version=3)

    assert exc_info.value.current_version == 4


def test_upsert_inserts_when_missing_and_expected_zero():
    write_conn, write_cur = _cursor_returning(None)
    read_conn, read_cur = _cursor_returning(
        {"config_key": "roi.defaults", "config_json": {"computeP": 1}, "version": 1, "updated_at": None}
    )
    contexts = [write_conn, read_conn]

    with patch.object(db, "db_connection") as context:
        context.return_value.__enter__.side_effect = contexts
        saved = db.upsert_config("roi.defaults", {"computeP": 1}, expected_version=0)

    assert saved["version"] == 1
    assert saved["data"]["computeP"] == 1
    insert_calls = [
        args for args, _kwargs in write_cur.execute.call_args_list if "INSERT INTO app_config " in args[0]
    ]
    assert insert_calls
    assert insert_calls[0][1][0] == "roi.defaults"


def test_upsert_force_skips_version_check():
    connection, cursor = _cursor_returning({"version": 9, "config_json": "{}"})
    read_conn, _read_cur = _cursor_returning(
        {"config_key": "roi.defaults", "config_json": {"ok": True}, "version": 10, "updated_at": None}
    )

    with patch.object(db, "db_connection") as context:
        context.return_value.__enter__.side_effect = [connection, read_conn]
        saved = db.upsert_config("roi.defaults", {"ok": True}, force=True)

    assert saved["version"] == 10
    assert cursor.rowcount == 1
