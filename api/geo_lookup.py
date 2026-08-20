"""IP → 国家/城市（缓存 + ip-api.com，失败时返回空）。

开发环境（如 Cursor）常从美国出口 IP 预览站点，默认从访问统计中排除美国。
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
CACHE_PATH = ROOT / "data" / "analytics" / "geo-cache.json"

# 本地样例 / 离线兜底（按 /16 前缀）
PREFIX_HINTS = {
    "111.229": ("中国", "广州"),
    "114.55": ("中国", "杭州"),
    "36.112": ("中国", "北京"),
    "58.210": ("中国", "苏州"),
    "120.36": ("中国", "厦门"),
    "8.8": ("美国", "山景城"),
}

# Cursor / 开发预览出口：不计入真实访客
EXCLUDED_COUNTRIES = frozenset(
    {
        "美国",
        "United States",
        "United States of America",
        "US",
        "USA",
    }
)


def is_excluded_country(country: str) -> bool:
    c = (country or "").strip()
    if not c or c == "—":
        return False
    if c in EXCLUDED_COUNTRIES:
        return True
    lower = c.lower()
    return lower in {"united states", "united states of america", "us", "usa"}


def _load_cache() -> Dict[str, Dict[str, str]]:
    if not CACHE_PATH.is_file():
        return {}
    try:
        data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_cache(cache: Dict[str, Dict[str, str]]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _hint(ip: str) -> Tuple[str, str]:
    if ":" in ip:
        return ("", "")
    parts = ip.split(".")
    if len(parts) >= 2:
        key = f"{parts[0]}.{parts[1]}"
        if key in PREFIX_HINTS:
            return PREFIX_HINTS[key]
    return ("", "")


def _fetch_one(ip: str, timeout: float = 3.0) -> Tuple[str, str]:
    url = f"http://ip-api.com/json/{ip}?lang=zh-CN&fields=status,country,city,message"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        if payload.get("status") == "success":
            return (str(payload.get("country") or ""), str(payload.get("city") or ""))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        pass
    return _hint(ip)


def lookup_ips(ips: Iterable[str], use_network: bool = True) -> Dict[str, Dict[str, str]]:
    """Return {ip: {country, city}} for unique IPs."""
    unique = []
    seen = set()
    for ip in ips:
        if not ip or ip in seen:
            continue
        seen.add(ip)
        unique.append(ip)

    cache = _load_cache()
    out: Dict[str, Dict[str, str]] = {}
    missing: List[str] = []

    for ip in unique:
        if ip in cache and (cache[ip].get("country") or cache[ip].get("city")):
            out[ip] = {
                "country": cache[ip].get("country") or "",
                "city": cache[ip].get("city") or "",
            }
        else:
            missing.append(ip)

    if missing and use_network:
        for i, ip in enumerate(missing):
            country, city = _fetch_one(ip)
            if not country and not city:
                country, city = _hint(ip)
            row = {"country": country, "city": city}
            out[ip] = row
            cache[ip] = row
            if i + 1 < len(missing):
                time.sleep(0.35)
        _save_cache(cache)
    else:
        for ip in missing:
            country, city = _hint(ip)
            out[ip] = {"country": country, "city": city}
            if country or city:
                cache[ip] = out[ip]
        if missing:
            _save_cache(cache)

    return out


def is_excluded_ip(
    ip: str,
    *,
    use_network: bool = True,
    memo: Optional[Dict[str, bool]] = None,
) -> bool:
    """True if this IP should be omitted from visitor analytics (e.g. US / Cursor egress)."""
    if not ip:
        return False
    if memo is not None and ip in memo:
        return memo[ip]
    geo = lookup_ips([ip], use_network=use_network).get(ip) or {}
    excluded = is_excluded_country(str(geo.get("country") or ""))
    if memo is not None:
        memo[ip] = excluded
    return excluded


def enrich_ip_rows(
    rows: List[Dict[str, object]],
    *,
    mask_fn,
    use_network: bool = True,
    exclude_us: bool = True,
) -> List[Dict[str, object]]:
    """rows: [{ip, hits}, ...] → masked ip + country + city（可排除美国）。"""
    geo = lookup_ips([str(r.get("ip") or "") for r in rows], use_network=use_network)
    enriched = []
    for r in rows:
        raw = str(r.get("ip") or "")
        g = geo.get(raw) or {}
        country = g.get("country") or "—"
        if exclude_us and is_excluded_country(str(country)):
            continue
        enriched.append(
            {
                "ip": mask_fn(raw),
                "hits": int(r.get("hits") or 0),
                "country": country,
                "city": g.get("city") or "—",
            }
        )
    return enriched
