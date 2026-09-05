from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class AdminVerifyResponse(BaseModel):
    authenticated: bool = True


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "down"]
    error: Optional[str] = None


class ConfigPayload(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)
    expected_version: int = Field(..., ge=0)


class ConfigResponse(BaseModel):
    key: str
    data: Dict[str, Any]
    version: int
    updated_at: Optional[str] = None


class AnalyticsRange(BaseModel):
    start: str
    end: str
    days: int


class AnalyticsTotals(BaseModel):
    pv: int = 0
    uv: int = 0
    uv_sum_daily: Optional[int] = None


class AnalyticsDailyRow(BaseModel):
    day: str
    pv: int
    uv: int
    html_pv: int


class AnalyticsPageRow(BaseModel):
    path: str
    hits: int


class AnalyticsIpRow(BaseModel):
    ip: str
    hits: int
    country: Optional[str] = None
    city: Optional[str] = None


class AnalyticsStatusRow(BaseModel):
    status: int
    hits: int


class AnalyticsSummaryResponse(BaseModel):
    generated_at: str
    source: str
    range: AnalyticsRange
    totals: AnalyticsTotals
    daily: List[AnalyticsDailyRow] = Field(default_factory=list)
    pages: List[AnalyticsPageRow] = Field(default_factory=list)
    ips: List[AnalyticsIpRow] = Field(default_factory=list)
    status: List[AnalyticsStatusRow] = Field(default_factory=list)
    note: Optional[str] = None
    warning: Optional[str] = None


class AnalyticsPagesResponse(BaseModel):
    range: Optional[AnalyticsRange] = None
    pages: List[AnalyticsPageRow] = Field(default_factory=list)


class AnalyticsIpsResponse(BaseModel):
    range: Optional[AnalyticsRange] = None
    ips: List[AnalyticsIpRow] = Field(default_factory=list)
