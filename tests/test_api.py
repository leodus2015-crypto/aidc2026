from unittest.mock import patch

from fastapi.testclient import TestClient

import analytics
import main

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


def test_get_config_db_down_503():
    with patch.object(main, "ping_database", return_value=False), patch.object(
        main, "get_db_error", return_value="down"
    ):
        res = client.get("/api/config/roi.defaults")
    assert res.status_code == 503


def test_get_config_ok():
    row = {"key": "roi.defaults", "data": {"computeP": 1}, "version": 2, "updated_at": None}
    with patch.object(main, "ping_database", return_value=True), patch.object(
        main, "fetch_config", return_value=row
    ):
        res = client.get("/api/config/roi.defaults")
    assert res.status_code == 200
    assert res.json()["data"]["computeP"] == 1


def test_put_config_requires_bearer():
    with patch.object(main, "ping_database", return_value=True):
        res = client.put("/api/config/roi.defaults", json={"data": {}})
    assert res.status_code == 401


def test_put_config_rejects_wrong_token():
    with patch.object(main, "ping_database", return_value=True):
        res = client.put(
            "/api/config/roi.defaults",
            json={"data": {}},
            headers={"Authorization": "Bearer wrong-token"},
        )
    assert res.status_code == 401


def test_put_config_rejects_when_admin_token_unset():
    with patch.object(main, "ADMIN_TOKEN", ""), patch.object(main, "ping_database", return_value=True):
        res = client.put(
            "/api/config/roi.defaults",
            json={"data": {}},
            headers={"Authorization": "Bearer anything"},
        )
    assert res.status_code == 503


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


def test_mask_ip_ipv4_and_ipv6():
    assert analytics.mask_ip("1.2.3.4") == "1.2.*.*"
    assert analytics.mask_ip("2001:db8:abcd:0012:0000:0000:0000:0001").startswith("2001:db8:")
    assert "*" in analytics.mask_ip("2001:db8:abcd:0012:0000:0000:0000:0001")
