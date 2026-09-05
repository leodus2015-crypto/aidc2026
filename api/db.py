from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional

import pymysql
from pymysql.cursors import DictCursor

from settings import (
    DATABASE_HOST,
    DATABASE_NAME,
    DATABASE_PASSWORD,
    DATABASE_PORT,
    DATABASE_USER,
    database_configured,
)

_db_error: Optional[str] = None
logger = logging.getLogger(__name__)


class DatabaseError(RuntimeError):
    """Safe database boundary error; internal driver details stay server-side."""


def get_db_error() -> Optional[str]:
    return _db_error


def ping_database() -> bool:
    global _db_error
    if not database_configured():
        _db_error = "DATABASE_* 环境变量未配置"
        return False
    try:
        with db_connection() as conn:
            conn.ping(reconnect=True)
        _db_error = None
        return True
    except DatabaseError:
        _db_error = "数据库不可用"
        return False


@contextmanager
def db_connection() -> Iterator[pymysql.connections.Connection]:
    if not database_configured():
        raise DatabaseError("数据库不可用")
    try:
        conn = pymysql.connect(
            host=DATABASE_HOST,
            port=DATABASE_PORT,
            user=DATABASE_USER,
            password=DATABASE_PASSWORD,
            database=DATABASE_NAME,
            charset="utf8mb4",
            cursorclass=DictCursor,
            autocommit=False,
        )
    except pymysql.MySQLError as exc:
        logger.exception("Database connection failed")
        raise DatabaseError("数据库不可用") from exc
    try:
        yield conn
        conn.commit()
    except pymysql.MySQLError as exc:
        conn.rollback()
        logger.exception("Database operation failed")
        raise DatabaseError("数据库操作失败") from exc
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_config(config_key: str) -> Optional[Dict[str, Any]]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT config_key, config_json, version, updated_at
                FROM app_config
                WHERE config_key = %s
                LIMIT 1
                """,
                (config_key,),
            )
            row = cur.fetchone()
    if not row:
        return None
    payload = row["config_json"]
    if isinstance(payload, str):
        payload = json.loads(payload)
    return {
        "key": row["config_key"],
        "data": payload,
        "version": row["version"],
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


def upsert_config(config_key: str, data: Dict[str, Any], updated_by: Optional[str] = None) -> Dict[str, Any]:
    payload = json.dumps(data, ensure_ascii=False)
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT version, config_json FROM app_config WHERE config_key = %s LIMIT 1",
                (config_key,),
            )
            existing = cur.fetchone()
            next_version = (existing["version"] + 1) if existing else 1
            if existing:
                cur.execute(
                    """
                    INSERT INTO app_config_revision (config_key, config_json, version, created_by)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (config_key, existing["config_json"], existing["version"], updated_by),
                )
                cur.execute(
                    """
                    UPDATE app_config
                    SET config_json = %s, version = %s, updated_by = %s
                    WHERE config_key = %s
                    """,
                    (payload, next_version, updated_by, config_key),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO app_config (config_key, config_json, version, updated_by)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (config_key, payload, next_version, updated_by),
                )
    saved = fetch_config(config_key)
    if not saved:
        raise RuntimeError("保存后读取失败")
    return saved
