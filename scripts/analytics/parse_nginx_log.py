#!/usr/bin/env python3
"""Parse Nginx access.log → MySQL analytics tables + data/analytics/summary.json.

Usage:
  ANALYTICS_LOG=/www/wwwlogs/aidc2026.cn.log python3 scripts/analytics/parse_nginx_log.py
  python3 scripts/analytics/parse_nginx_log.py --log /path/to/access.log --full
  python3 scripts/analytics/parse_nginx_log.py --days 30   # rebuild JSON snapshot only from DB
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "api"))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass

# Combined / common log formats
LOG_RE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] '
    r'"(?P<method>\S+) (?P<path>\S+)(?: (?P<proto>[^"]*))?" '
    r'(?P<status>\d{3}) (?P<size>\S+) '
    r'"(?P<referer>[^"]*)" "(?P<ua>[^"]*)"'
)

STATIC_EXT = {
    ".js",
    ".css",
    ".map",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp4",
    ".webm",
    ".json",
}
SKIP_PREFIXES = ("/api/health",)
BOT_UA_HINTS = (
    "bot",
    "spider",
    "crawler",
    "curl/",
    "wget/",
    "python-requests",
    "httpclient",
    "scrapy",
    "monitor",
    "uptime",
)


def parse_time(raw: str) -> Optional[datetime]:
    # 12/Jun/2026:10:30:01 +0800
    try:
        return datetime.strptime(raw.split()[0], "%d/%b/%Y:%H:%M:%S")
    except ValueError:
        return None


def normalize_path(raw: str) -> str:
    path = raw.split("?", 1)[0]
    if not path.startswith("/"):
        path = "/" + path
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    return path[:500]


def is_page_hit(method: str, path: str, status: int) -> bool:
    if method.upper() not in ("GET", "HEAD"):
        return False
    if status >= 400:
        return False
    lower = path.lower()
    for prefix in SKIP_PREFIXES:
        if lower.startswith(prefix):
            return False
    ext = Path(lower).suffix
    if ext in STATIC_EXT:
        return False
    # treat bare routes and html as page views
    return ext in ("", ".html", ".htm") or "/" in path.strip("/")


def is_html_path(path: str) -> bool:
    lower = path.lower()
    return lower.endswith(".html") or lower.endswith(".htm") or lower in ("/", "/aidc", "/aidc/")


def looks_like_bot(ua: str) -> bool:
    u = (ua or "").lower()
    return any(h in u for h in BOT_UA_HINTS)


def iter_log_lines(path: Path, start_offset: int = 0) -> Tuple[Iterable[str], int, str]:
    st = path.stat()
    inode = f"{st.st_dev}:{st.st_ino}"
    # rotated: file smaller than cursor → start over
    offset = 0 if st.st_size < start_offset else start_offset

    def gen() -> Iterable[str]:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            f.seek(offset)
            while True:
                line = f.readline()
                if not line:
                    break
                yield line

    return gen(), st.st_size, inode


def aggregate_lines(
    lines: Iterable[str],
    skip_bots: bool,
    skip_us: bool = True,
    *,
    geo_network: bool = False,
) -> Dict[str, Any]:
    """聚合访问行。

    geo_network=False（默认）：排除美国时只用本地缓存/前缀提示，避免全量解析时
    对每个 IP 串行请求 ip-api（50MB+ 日志会卡数小时）。展示侧仍可对 IP Top 做网络补全。
    """
    daily_pv: Dict[date, int] = defaultdict(int)
    daily_html: Dict[date, int] = defaultdict(int)
    daily_ips: Dict[date, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    daily_pages: Dict[date, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    daily_status: Dict[date, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
    parsed = 0
    skipped = 0
    skipped_us = 0
    us_memo: Dict[str, bool] = {}

    try:
        from geo_lookup import is_excluded_ip
    except ImportError:
        is_excluded_ip = None  # type: ignore

    for line in lines:
        m = LOG_RE.match(line.strip())
        if not m:
            skipped += 1
            continue
        dt = parse_time(m.group("time"))
        if not dt:
            skipped += 1
            continue
        day = dt.date()
        method = m.group("method")
        path = normalize_path(m.group("path"))
        try:
            status = int(m.group("status"))
        except ValueError:
            skipped += 1
            continue
        ip = m.group("ip")
        ua = m.group("ua") or ""

        if skip_us and is_excluded_ip is not None and is_excluded_ip(
            ip, use_network=geo_network, memo=us_memo
        ):
            skipped_us += 1
            skipped += 1
            continue

        daily_status[day][status] += 1

        if skip_bots and looks_like_bot(ua):
            skipped += 1
            continue
        if not is_page_hit(method, path, status):
            skipped += 1
            continue

        daily_pv[day] += 1
        daily_ips[day][ip] += 1
        daily_pages[day][path] += 1
        if is_html_path(path):
            daily_html[day] += 1
        parsed += 1

    return {
        "daily_pv": daily_pv,
        "daily_html": daily_html,
        "daily_ips": daily_ips,
        "daily_pages": daily_pages,
        "daily_status": daily_status,
        "parsed": parsed,
        "skipped": skipped,
        "skipped_us": skipped_us,
    }


def db_available() -> bool:
    try:
        from db import ping_database

        return ping_database()
    except Exception:
        return False


def load_cursor(log_path: str) -> Tuple[int, Optional[str]]:
    from db import db_connection

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT byte_offset, inode FROM analytics_log_cursor WHERE log_path = %s",
                (log_path,),
            )
            row = cur.fetchone()
    if not row:
        return 0, None
    return int(row["byte_offset"] or 0), row.get("inode")


def save_cursor(log_path: str, offset: int, inode: str) -> None:
    from db import db_connection

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO analytics_log_cursor (log_path, byte_offset, inode)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE byte_offset = VALUES(byte_offset), inode = VALUES(inode)
                """,
                (log_path, offset, inode),
            )


def merge_into_db(agg: Dict[str, Any]) -> None:
    from db import db_connection

    with db_connection() as conn:
        with conn.cursor() as cur:
            for day, pv in agg["daily_pv"].items():
                uv = len(agg["daily_ips"][day])
                html_pv = agg["daily_html"].get(day, 0)
                cur.execute(
                    """
                    INSERT INTO analytics_daily (day, pv, uv, html_pv)
                    VALUES (%s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                      pv = pv + VALUES(pv),
                      uv = GREATEST(uv, VALUES(uv)),
                      html_pv = html_pv + VALUES(html_pv)
                    """,
                    (day, pv, uv, html_pv),
                )
                # Recompute UV exactly for that day from ip table after merge
            for day, ips in agg["daily_ips"].items():
                for ip, hits in ips.items():
                    cur.execute(
                        """
                        INSERT INTO analytics_daily_ips (day, ip, hits)
                        VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE hits = hits + VALUES(hits)
                        """,
                        (day, ip, hits),
                    )
                cur.execute(
                    "SELECT COUNT(*) AS c FROM analytics_daily_ips WHERE day = %s",
                    (day,),
                )
                uv = int(cur.fetchone()["c"])
                cur.execute(
                    "UPDATE analytics_daily SET uv = %s WHERE day = %s",
                    (uv, day),
                )
            for day, pages in agg["daily_pages"].items():
                for path, hits in pages.items():
                    cur.execute(
                        """
                        INSERT INTO analytics_daily_pages (day, path, hits)
                        VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE hits = hits + VALUES(hits)
                        """,
                        (day, path, hits),
                    )
            for day, statuses in agg["daily_status"].items():
                for code, hits in statuses.items():
                    cur.execute(
                        """
                        INSERT INTO analytics_daily_status (day, status_code, hits)
                        VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE hits = hits + VALUES(hits)
                        """,
                        (day, code, hits),
                    )


def mask_ip(ip: str) -> str:
    if ":" in ip:
        parts = ip.split(":")
        return ":".join(parts[:2] + ["*"] * max(0, len(parts) - 2))
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.*.*"
    return ip


def build_snapshot(days: int = 30) -> Dict[str, Any]:
    from db import db_connection

    end = date.today()
    start = end - timedelta(days=days - 1)
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
            try:
                from geo_lookup import enrich_ip_rows, is_excluded_ip

                ips = enrich_ip_rows(raw_ips, mask_fn=mask_ip, use_network=True, exclude_us=True)[
                    :50
                ]
                excluded_ips = {
                    r["ip"] for r in raw_ips if is_excluded_ip(str(r["ip"]), use_network=True)
                }
            except Exception:
                ips = [
                    {"ip": mask_ip(r["ip"]), "hits": r["hits"], "country": "—", "city": "—"}
                    for r in raw_ips[:50]
                ]
                excluded_ips = set()
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
                "SELECT COALESCE(SUM(pv),0) AS pv, COALESCE(SUM(uv),0) AS uv_sum FROM analytics_daily WHERE day BETWEEN %s AND %s",
                (start, end),
            )
            tot = cur.fetchone() or {"pv": 0, "uv_sum": 0}
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
            else:
                cur.execute(
                    """
                    SELECT COUNT(DISTINCT ip) AS uv
                    FROM analytics_daily_ips
                    WHERE day BETWEEN %s AND %s
                    """,
                    (start, end),
                )
            uv_period = int((cur.fetchone() or {}).get("uv") or 0)

    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "totals": {
            "pv": int(tot["pv"] or 0),
            "uv": uv_period,
            "uv_sum_daily": int(tot["uv_sum"] or 0),
        },
        "daily": daily,
        "pages": pages,
        "ips": ips,
        "status": status,
    }


def write_snapshot(snapshot: Dict[str, Any]) -> Path:
    out_dir = ROOT / "data" / "analytics"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "summary.json"
    out.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # prevent directory listing hints
    (out_dir / ".gitkeep").touch()
    return out


def write_empty_snapshot(days: int = 30) -> Path:
    end = date.today()
    start = end - timedelta(days=days - 1)
    return write_snapshot(
        {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
            "totals": {"pv": 0, "uv": 0, "uv_sum_daily": 0},
            "daily": [],
            "pages": [],
            "ips": [],
            "status": [],
            "note": "尚无数据：请配置 ANALYTICS_LOG 并运行解析脚本",
        }
    )


def build_snapshot_from_agg(agg: Dict[str, Any], days: int = 30) -> Dict[str, Any]:
    end = date.today()
    start = end - timedelta(days=days - 1)
    daily = []
    all_ips: Dict[str, int] = defaultdict(int)
    all_pages: Dict[str, int] = defaultdict(int)
    all_status: Dict[int, int] = defaultdict(int)
    for i in range(days):
        d = start + timedelta(days=i)
        pv = int(agg["daily_pv"].get(d, 0))
        uv = len(agg["daily_ips"].get(d, {}))
        html_pv = int(agg["daily_html"].get(d, 0))
        daily.append({"day": d.isoformat(), "pv": pv, "uv": uv, "html_pv": html_pv})
        for ip, hits in agg["daily_ips"].get(d, {}).items():
            all_ips[ip] += hits
        for path, hits in agg["daily_pages"].get(d, {}).items():
            all_pages[path] += hits
        for code, hits in agg["daily_status"].get(d, {}).items():
            all_status[code] += hits

    pages = [
        {"path": p, "hits": h}
        for p, h in sorted(all_pages.items(), key=lambda x: x[1], reverse=True)[:20]
    ]
    ips = [
        {"ip": ip, "hits": h}
        for ip, h in sorted(all_ips.items(), key=lambda x: x[1], reverse=True)[:50]
    ]
    try:
        from geo_lookup import enrich_ip_rows

        ips = enrich_ip_rows(ips, mask_fn=mask_ip, use_network=True, exclude_us=True)
    except Exception:
        ips = [
            {"ip": mask_ip(row["ip"]), "hits": row["hits"], "country": "—", "city": "—"}
            for row in ips
        ]
    status = [
        {"status": code, "hits": h}
        for code, h in sorted(all_status.items(), key=lambda x: x[1], reverse=True)
    ]
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source": "json-only",
        "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "totals": {
            "pv": sum(x["pv"] for x in daily),
            "uv": len(all_ips),
            "uv_sum_daily": sum(x["uv"] for x in daily),
        },
        "daily": daily,
        "pages": pages,
        "ips": ips,
        "status": status,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse Nginx access.log into analytics tables")
    parser.add_argument(
        "--log",
        default=os.getenv("ANALYTICS_LOG", "").strip(),
        help="access.log path (or ANALYTICS_LOG env)",
    )
    parser.add_argument("--full", action="store_true", help="re-read entire log (reset cursor)")
    parser.add_argument("--days", type=int, default=30, help="snapshot window days")
    parser.add_argument("--include-bots", action="store_true", help="do not filter bot UA")
    parser.add_argument("--snapshot-only", action="store_true", help="only rebuild JSON from DB")
    parser.add_argument(
        "--json-only",
        action="store_true",
        help="parse log and write summary.json only (no MySQL; for local smoke test)",
    )
    parser.add_argument(
        "--geo-network",
        action="store_true",
        help="解析时对每个 IP 联网查国家（慢；默认仅用缓存/前缀提示排除美国）",
    )
    args = parser.parse_args()

    if args.json_only:
        if not args.log:
            print("✗ --json-only 需要 --log", file=sys.stderr)
            return 1
        log_path = Path(args.log)
        if not log_path.is_file():
            print(f"✗ 日志文件不存在: {log_path}", file=sys.stderr)
            return 1
        buffered = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
        agg = aggregate_lines(
            buffered, skip_bots=not args.include_bots, geo_network=args.geo_network
        )
        out = write_snapshot(build_snapshot_from_agg(agg, args.days))
        print(
            f"✓ json-only parsed={agg['parsed']} skipped={agg['skipped']} "
            f"skipped_us={agg.get('skipped_us', 0)} → {out}"
        )
        return 0

    if not db_available():
        print("✗ MySQL 不可用：请配置 .env 中 DATABASE_* 并执行 sql/analytics.sql", file=sys.stderr)
        print("  本地无库时可：python3 scripts/analytics/parse_nginx_log.py --json-only --log …", file=sys.stderr)
        write_empty_snapshot(args.days)
        return 1

    if args.snapshot_only:
        out = write_snapshot(build_snapshot(args.days))
        print(f"✓ snapshot → {out}")
        return 0

    if not args.log:
        print("✗ 未指定 --log / ANALYTICS_LOG，仅重建 snapshot", file=sys.stderr)
        out = write_snapshot(build_snapshot(args.days))
        print(f"✓ snapshot → {out}")
        return 0

    log_path = Path(args.log)
    if not log_path.is_file():
        print(f"✗ 日志文件不存在: {log_path}", file=sys.stderr)
        return 1

    start_offset = 0
    if not args.full:
        start_offset, _prev_inode = load_cursor(str(log_path.resolve()))

    lines, end_offset, inode = iter_log_lines(log_path, start_offset)
    # materialize to allow seeking progress even if empty
    buffered = list(lines)
    if not buffered and end_offset == start_offset:
        print("· 无新日志行")
        out = write_snapshot(build_snapshot(args.days))
        print(f"✓ snapshot → {out}")
        return 0

    if not args.geo_network:
        print("· geo: offline（缓存/前缀）；需要全量联网排除美国请加 --geo-network")
    agg = aggregate_lines(
        buffered, skip_bots=not args.include_bots, geo_network=args.geo_network
    )
    if args.full:
        # full rebuild: wipe then insert — safer to truncate related tables for overlapping days
        from db import db_connection

        days = sorted(set(agg["daily_pv"].keys()) | set(agg["daily_status"].keys()))
        if days:
            with db_connection() as conn:
                with conn.cursor() as cur:
                    for d in days:
                        cur.execute("DELETE FROM analytics_daily WHERE day = %s", (d,))
                        cur.execute("DELETE FROM analytics_daily_pages WHERE day = %s", (d,))
                        cur.execute("DELETE FROM analytics_daily_ips WHERE day = %s", (d,))
                        cur.execute("DELETE FROM analytics_daily_status WHERE day = %s", (d,))

    merge_into_db(agg)
    save_cursor(str(log_path.resolve()), end_offset, inode)
    out = write_snapshot(build_snapshot(args.days))
    print(
        f"✓ parsed={agg['parsed']} skipped={agg['skipped']} "
        f"offset={start_offset}→{end_offset} snapshot={out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
