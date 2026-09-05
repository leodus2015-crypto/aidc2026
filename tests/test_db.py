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
