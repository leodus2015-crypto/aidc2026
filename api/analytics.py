"""Analytics read helpers (Nginx log aggregates)."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from db import db_connection

ROOT = Path(__file__).resolve().parent.parent
SUMMARY_JSON = ROOT / "data" / "analytics" / "summary.json"


def mask_ip(ip: str) -> str:
    if ":" in ip:
        parts = ip.split(":")
        return ":".join(parts[:2] + ["*"] * max(0, len(parts) - 2))
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.*.*"
    return ip


def load_summary_file() -> Optional[Dict[str, Any]]:
    if not SUMMARY_JSON.is_file():
        return None
    try:
        return json.loads(SUMMARY_JSON.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def query_summary(days: int = 30) -> Dict[str, Any]:
    end = date.today()
    start = end - timedelta(days=max(1, days) - 1)
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT day, pv, uv, html_pv
                FROM analytics_daily
                WHERE day BETWEEN %s AND %s
                ORDER BY day ASC
                """,
                (start, end),
            )
            daily = [
                {
                    "day": r["day"].isoformat(),
                    "pv": int(r["pv"]),
                    "uv": int(r["uv"]),
                    "html_pv": int(r["html_pv"]),
                }
                for r in cur.fetchall()
            ]
            cur.execute(
                """
                SELECT path, SUM(hits) AS hits
                FROM analytics_daily_pages
                WHERE day BETWEEN %s AND %s
                GROUP BY path
                ORDER BY hits DESC
                LIMIT 20
                """,
                (start, end),
            )
            pages = [{"path": r["path"], "hits": int(r["hits"])} for r in cur.fetchall()]
            cur.execute(
                """
                SELECT ip, SUM(hits) AS hits
                FROM analytics_daily_ips
                WHERE day BETWEEN %s AND %s
                GROUP BY ip
                ORDER BY hits DESC
                LIMIT 120
                """,
                (start, end),
            )
            raw_ips = [{"ip": r["ip"], "hits": int(r["hits"])} for r in cur.fetchall()]
            from geo_lookup import enrich_ip_rows, is_excluded_ip

            # UV/PV 历史若已含美国 IP，展示侧至少排除 IP Top；完整校正需 --full 重解析
            ips = enrich_ip_rows(raw_ips, mask_fn=mask_ip, use_network=True, exclude_us=True)[:50]
            excluded_ips = {
                r["ip"] for r in raw_ips if is_excluded_ip(str(r["ip"]), use_network=True)
            }
            if excluded_ips:
                cur.execute(
                    """
                    SELECT COUNT(DISTINCT ip) AS uv
                    FROM analytics_daily_ips
                    WHERE day BETWEEN %s AND %s
                      AND ip NOT IN ({placeholders})
                    """.format(placeholders=",".join(["%s"] * len(excluded_ips))),
                    (start, end, *sorted(excluded_ips)),
                )
                uv = int((cur.fetchone() or {}).get("uv") or 0)
            else:
                cur.execute(
                    """
                    SELECT COUNT(DISTINCT ip) AS uv
                    FROM analytics_daily_ips
                    WHERE day BETWEEN %s AND %s
                    """,
                    (start, end),
                )
                uv = int((cur.fetchone() or {}).get("uv") or 0)
            cur.execute(
                """
                SELECT status_code, SUM(hits) AS hits
                FROM analytics_daily_status
                WHERE day BETWEEN %s AND %s
                GROUP BY status_code
                ORDER BY hits DESC
                """,
                (start, end),
            )
            status = [
                {"status": int(r["status_code"]), "hits": int(r["hits"])}
                for r in cur.fetchall()
            ]
            cur.execute(
                "SELECT COALESCE(SUM(pv),0) AS pv FROM analytics_daily WHERE day BETWEEN %s AND %s",
                (start, end),
            )
            tot_pv = int((cur.fetchone() or {}).get("pv") or 0)

    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source": "mysql",
        "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "totals": {"pv": tot_pv, "uv": uv},
        "daily": daily,
        "pages": pages,
        "ips": ips,
        "status": status,
    }


def empty_summary(days: int = 30) -> Dict[str, Any]:
    end = date.today()
    start = end - timedelta(days=max(1, days) - 1)
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source": "empty",
        "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "totals": {"pv": 0, "uv": 0},
        "daily": [],
        "pages": [],
        "ips": [],
        "status": [],
        "note": "尚无统计数据",
    }
