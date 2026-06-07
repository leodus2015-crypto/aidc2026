from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import fetch_config, get_db_error, ping_database, upsert_config
from settings import ADMIN_TOKEN, ALLOWED_CONFIG_KEYS, CORS_ORIGINS, API_HOST, API_PORT

app = FastAPI(title="AIDC Config API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class ConfigPayload(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)


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
    token = (authorization or "").removeprefix("Bearer").strip()
    if not token or token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="未授权")
    if not ping_database():
        raise HTTPException(status_code=503, detail=get_db_error() or "数据库不可用")
    if not isinstance(body.data, dict):
        raise HTTPException(status_code=400, detail="data 必须为对象")
    try:
        return upsert_config(config_key, body.data, updated_by="admin")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=True)
