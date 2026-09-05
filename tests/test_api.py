from unittest.mock import patch

from fastapi.testclient import TestClient

import analytics
import main
from db import ConfigConflictError, DatabaseError

client = TestClient(main.app)


def test_health_degraded_when_db_down():
    with patch.object(main, "ping_database", return_value=False), patch.object(
        main, "get_db_error", return_value="DATABASE_* 环境变量未配置"
    ):
        res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "degraded"
    assert body["database"] == "down"
    assert "error" in body


def test_health_ok_when_db_up():
    with patch.object(main, "ping_database", return_value=True):
        res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_get_config_unknown_key_404():
    res = client.get("/api/config/not.a.real.key")
    assert res.status_code == 404


def test_unlock_password_is_not_public_config():
    res = client.get("/api/config/site.unlock_password")
    assert res.status_code == 404


def test_get_config_db_down_503():
    with patch.object(main, "fetch_config", side_effect=DatabaseError("driver detail must not leak")):
        res = client.get("/api/config/roi.defaults")
    assert res.status_code == 503
    body = res.json()
    assert body["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert body["error"]["message"] == "数据库不可用"
    assert "driver detail" not in res.text
    assert body["error"]["request_id"] == res.headers["x-request-id"]


def test_get_config_ok():
    row = {"key": "roi.defaults", "data": {"computeP": 1}, "version": 2, "updated_at": None}
    with patch.object(main, "ping_database", side_effect=AssertionError("must not ping")), patch.object(
        main, "fetch_config", return_value=row
    ):
        res = client.get("/api/config/roi.defaults")
    assert res.status_code == 200
    assert res.json()["data"]["computeP"] == 1


def test_put_config_requires_bearer():
    with patch.object(main, "ping_database", return_value=True):
        res = client.put("/api/config/roi.defaults", json={"data": {}, "expected_version": 0})
    assert res.status_code == 401


def test_put_config_rejects_wrong_token():
    with patch.object(main, "ping_database", return_value=True):
        res = client.put(
            "/api/config/roi.defaults",
            json={"data": {}, "expected_version": 0},
            headers={"Authorization": "Bearer wrong-token"},
        )
    assert res.status_code == 401


def test_put_config_rejects_when_admin_token_unset():
    with patch.object(main, "ADMIN_TOKEN", ""), patch.object(main, "ping_database", return_value=True):
        res = client.put(
            "/api/config/roi.defaults",
            json={"data": {}, "expected_version": 0},
            headers={"Authorization": "Bearer anything"},
        )
    assert res.status_code == 503


def test_put_config_requires_expected_version():
    with patch.object(main, "ADMIN_TOKEN", "strong-test-token"):
        res = client.put(
            "/api/config/roi.defaults",
            json={"data": {}},
            headers={"Authorization": "Bearer strong-test-token"},
        )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_put_config_conflict_returns_409():
    with patch.object(main, "ADMIN_TOKEN", "strong-test-token"), patch.object(
        main, "upsert_config", side_effect=ConfigConflictError(5)
    ):
        res = client.put(
            "/api/config/roi.defaults",
            json={"data": {"computeP": 1}, "expected_version": 4},
            headers={"Authorization": "Bearer strong-test-token"},
        )
    assert res.status_code == 409
    body = res.json()
    assert body["error"]["code"] == "CONFLICT"
    assert "重新加载" in body["error"]["message"]


def test_verify_admin_accepts_valid_bearer():
    with patch.object(main, "ADMIN_TOKEN", "strong-test-token"):
        res = client.post(
            "/api/admin/verify",
            headers={"Authorization": "Bearer strong-test-token"},
        )
    assert res.status_code == 200
    assert res.json() == {"authenticated": True}


def test_verify_admin_rejects_invalid_scheme_and_token():
    with patch.object(main, "ADMIN_TOKEN", "strong-test-token"):
        invalid_scheme = client.post(
            "/api/admin/verify",
            headers={"Authorization": "Basic strong-test-token"},
        )
        invalid_token = client.post(
            "/api/admin/verify",
            headers={"Authorization": "Bearer wrong-token"},
        )
    assert invalid_scheme.status_code == 401
    assert invalid_token.status_code == 401


def test_cors_allows_api_client_request_headers():
    res = client.options(
        "/api/admin/verify",
        headers={
            "Origin": "http://127.0.0.1:8011",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,x-request-id",
        },
    )
    assert res.status_code == 200
    allowed = res.headers.get("access-control-allow-headers", "").lower()
    assert "authorization" in allowed
    assert "x-request-id" in allowed


def test_request_id_is_echoed_or_replaced_when_invalid():
    valid = client.get("/api/config/not.a.real.key", headers={"X-Request-ID": "web-test_123"})
    invalid = client.get("/api/config/not.a.real.key", headers={"X-Request-ID": "bad request id"})
    assert valid.headers["x-request-id"] == "web-test_123"
    assert valid.json()["error"]["request_id"] == "web-test_123"
    assert invalid.headers["x-request-id"] != "bad request id"
    assert invalid.json()["error"]["request_id"] == invalid.headers["x-request-id"]


def test_analytics_rejects_when_admin_token_unset():
    with patch.object(main, "ADMIN_TOKEN", ""):
        res = client.get(
            "/api/analytics/summary",
            headers={"Authorization": "Bearer anything"},
        )
    assert res.status_code == 503


def test_analytics_requires_auth():
    res = client.get("/api/analytics/summary")
    assert res.status_code == 401


def test_analytics_database_error_uses_validated_local_fallback():
    with patch.object(main, "ADMIN_TOKEN", "strong-test-token"), patch.object(
        main,
        "query_summary",
        side_effect=DatabaseError("driver detail"),
    ):
        res = client.get(
            "/api/analytics/summary?days=14",
            headers={"Authorization": "Bearer strong-test-token"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "json-fallback"
    assert body["warning"] == "数据库不可用，当前显示本地聚合快照"
    assert body["range"]["days"] == 14


def test_mask_ip_ipv4_and_ipv6():
    assert analytics.mask_ip("1.2.3.4") == "1.2.*.*"
    assert analytics.mask_ip("2001:db8:abcd:0012:0000:0000:0000:0001").startswith("2001:db8:")
    assert "*" in analytics.mask_ip("2001:db8:abcd:0012:0000:0000:0000:0001")
