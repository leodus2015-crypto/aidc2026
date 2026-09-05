from __future__ import annotations

import hmac
import logging
import re
import uuid
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from analytics import empty_summary, load_summary_file, query_summary
from db import ConfigConflictError, DatabaseError, fetch_config, get_db_error, ping_database, upsert_config
from schemas import (
    AdminVerifyResponse,
    AnalyticsIpsResponse,
    AnalyticsPagesResponse,
    AnalyticsSummaryResponse,
    ConfigPayload,
    ConfigResponse,
    HealthResponse,
)
from settings import ADMIN_TOKEN, ALLOWED_CONFIG_KEYS, CORS_ORIGINS, API_HOST, API_PORT

logger = logging.getLogger(__name__)
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")

app = FastAPI(title="AIDC Config API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    supplied = request.headers.get("X-Request-ID", "")
    request_id = supplied if REQUEST_ID_RE.fullmatch(supplied) else uuid.uuid4().hex
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


def error_code(status_code: int) -> str:
    return {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        503: "SERVICE_UNAVAILABLE",
    }.get(status_code, "HTTP_ERROR")


def error_response(request: Request, status_code: int, code: str, message: str) -> JSONResponse:
    request_id = getattr(request.state, "request_id", uuid.uuid4().hex)
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "request_id": request_id}},
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(HTTPException)
async def handle_http_error(request: Request, exc: HTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "请求失败"
    return error_response(request, exc.status_code, error_code(exc.status_code), message)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, _exc: RequestValidationError):
    return error_response(request, 422, "VALIDATION_ERROR", "请求参数无效")


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    logger.exception("Unhandled API error request_id=%s", request.state.request_id, exc_info=exc)
    return error_response(request, 500, "INTERNAL_ERROR", "服务器内部错误")


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


@app.post("/api/admin/verify", response_model=AdminVerifyResponse)
def verify_admin(authorization: Optional[str] = Header(default=None)) -> Dict[str, bool]:
    require_admin(authorization)
    return {"authenticated": True}


@app.get("/api/health", response_model=HealthResponse, response_model_exclude_none=True)
def health() -> Dict[str, str]:
    ok = ping_database()
    body = {
        "status": "ok" if ok else "degraded",
        "database": "ok" if ok else "down",
    }
    if not ok:
        body["error"] = get_db_error()
    return body


@app.get("/api/config/{config_key}", response_model=ConfigResponse)
def get_config(config_key: str) -> Dict[str, Any]:
    if config_key not in ALLOWED_CONFIG_KEYS:
        raise HTTPException(status_code=404, detail="未知配置键")
    try:
        row = fetch_config(config_key)
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="数据库不可用") from exc
    if not row:
        raise HTTPException(status_code=404, detail="配置不存在")
    return row


@app.put("/api/config/{config_key}", response_model=ConfigResponse)
def put_config(
    config_key: str,
    body: ConfigPayload,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    if config_key not in ALLOWED_CONFIG_KEYS:
        raise HTTPException(status_code=404, detail="未知配置键")
    require_admin(authorization)
    try:
        return upsert_config(
            config_key,
            body.data,
            updated_by="admin",
            expected_version=body.expected_version,
        )
    except ConfigConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="数据库不可用") from exc


@app.get("/api/analytics/summary", response_model=AnalyticsSummaryResponse)
def analytics_summary(
    days: int = Query(default=30, ge=1, le=90),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """日 PV/UV、页面 Top、IP Top（脱敏）、状态码分布。需 Bearer ADMIN_TOKEN。"""
    require_admin(authorization)
    return _analytics_payload(days)


def _analytics_payload(days: int) -> Dict[str, Any]:
    try:
        return query_summary(days)
    except DatabaseError:
        file_data = load_summary_file()
        if file_data:
            file_data = dict(file_data)
            file_data["source"] = "json-fallback"
            file_data["warning"] = "数据库不可用，当前显示本地聚合快照"
            return file_data
        return empty_summary(days)


@app.get("/api/analytics/pages", response_model=AnalyticsPagesResponse)
def analytics_pages(
    days: int = Query(default=7, ge=1, le=90),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    require_admin(authorization)
    data = _analytics_payload(days)
    return {"range": data.get("range"), "pages": data.get("pages") or []}


@app.get("/api/analytics/ips", response_model=AnalyticsIpsResponse)
def analytics_ips(
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=50, ge=1, le=100),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    require_admin(authorization)
    data = _analytics_payload(days)
    ips = (data.get("ips") or [])[:limit]
    return {"range": data.get("range"), "ips": ips}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=True)
