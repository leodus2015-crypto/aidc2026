from __future__ import annotations

import hmac
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from analytics import empty_summary, load_summary_file, query_summary
from db import fetch_config, get_db_error, ping_database, upsert_config
from settings import ADMIN_TOKEN, ALLOWED_CONFIG_KEYS, CORS_ORIGINS, API_HOST, API_PORT

app = FastAPI(title="AIDC Config API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


def require_admin(authorization: Optional[str]) -> None:
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="ADMIN_TOKEN 未配置")
    scheme, separator, token = (authorization or "").partition(" ")
    if (
        separator != " "
        or scheme.lower() != "bearer"
        or not token
        or not hmac.compare_digest(token.strip(), ADMIN_TOKEN)
    ):
        raise HTTPException(status_code=401, detail="未授权")


class ConfigPayload(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)


@app.post("/api/admin/verify")
def verify_admin(authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    return {"authenticated": True}


@app.get("/api/health")
def health():
    ok = ping_database()
    body = {
        "status": "ok" if ok else "degraded",
        "database": "ok" if ok else "down",
    }
    if not ok:
        body["error"] = get_db_error()
    return body


@app.get("/api/config/{config_key}")
def get_config(config_key: str):
    if config_key not in ALLOWED_CONFIG_KEYS:
        raise HTTPException(status_code=404, detail="未知配置键")
    if not ping_database():
        raise HTTPException(status_code=503, detail=get_db_error() or "数据库不可用")
    row = fetch_config(config_key)
    if not row:
        raise HTTPException(status_code=404, detail="配置不存在")
    return row


@app.put("/api/config/{config_key}")
def put_config(
    config_key: str,
    body: ConfigPayload,
    authorization: Optional[str] = Header(default=None),
):
    if config_key not in ALLOWED_CONFIG_KEYS:
        raise HTTPException(status_code=404, detail="未知配置键")
    require_admin(authorization)
    if not ping_database():
        raise HTTPException(status_code=503, detail=get_db_error() or "数据库不可用")
    if not isinstance(body.data, dict):
        raise HTTPException(status_code=400, detail="data 必须为对象")
    try:
        return upsert_config(config_key, body.data, updated_by="admin")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/analytics/summary")
def analytics_summary(
    days: int = Query(default=30, ge=1, le=90),
    authorization: Optional[str] = Header(default=None),
):
    """日 PV/UV、页面 Top、IP Top（脱敏）、状态码分布。需 Bearer ADMIN_TOKEN。"""
    require_admin(authorization)
    return _analytics_payload(days)


def _analytics_payload(days: int) -> Dict[str, Any]:
    if ping_database():
        try:
            return query_summary(days)
        except Exception as exc:  # noqa: BLE001
            file_data = load_summary_file()
            if file_data:
                file_data = dict(file_data)
                file_data["source"] = "json-fallback"
                file_data["warning"] = str(exc)
                return file_data
            raise HTTPException(status_code=500, detail=str(exc)) from exc
    file_data = load_summary_file()
    if file_data:
        file_data = dict(file_data)
        file_data["source"] = "json"
        return file_data
    return empty_summary(days)


@app.get("/api/analytics/pages")
def analytics_pages(
    days: int = Query(default=7, ge=1, le=90),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    data = _analytics_payload(days)
    return {"range": data.get("range"), "pages": data.get("pages") or []}


@app.get("/api/analytics/ips")
def analytics_ips(
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=50, ge=1, le=100),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    data = _analytics_payload(days)
    ips = (data.get("ips") or [])[:limit]
    return {"range": data.get("range"), "ips": ips}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=True)
