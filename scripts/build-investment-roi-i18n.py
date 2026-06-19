#!/usr/bin/env python3
"""DEPRECATED: en/ 已移除。请直接编辑 i18n/aidc-investment-roi.en.json。"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZH = ROOT / "aidc-investment-roi.html"
EN = ROOT / "en" / "aidc-investment-roi.html"


def extract_js_strings(js: str) -> list[str]:
    out: list[str] = []
    for m in re.finditer(r"(['\"])(.*?)\1", js, re.S):
        s = m.group(2)
        if re.search(r"[\u4e00-\u9fff]", s) and len(s) < 200:
            out.append(s)
    return out


def read_main_js(html: str) -> str:
    m = re.search(r'<script src="js/config-loader.js"></script>\s*<script>(.*?)</script>', html, re.S)
    return m.group(1) if m else ""


def pair_strings(zh_list: list[str], en_list: list[str]) -> dict[str, str]:
    lookup: dict[str, str] = {}
    if len(zh_list) == len(en_list):
        for z, e in zip(zh_list, en_list):
            lookup[z] = e
    return lookup


def extract_static_pairs(zh_html: str, en_html: str) -> dict[str, str]:
    """Pair simple text nodes between zh/en main sections by order."""
    def texts(html: str) -> list[str]:
        main = re.search(r"<main[^>]*>(.*?)</main>", html, re.S)
        if not main:
            return []
        chunk = main.group(1)
        chunk = re.sub(r"<script.*?</script>", "", chunk, flags=re.S)
        parts = re.findall(r">([^<>{}]+?)<", chunk)
        return [p.strip() for p in parts if p.strip() and len(p.strip()) < 120]

    zh_t, en_t = texts(zh_html), texts(en_html)
    out: dict[str, str] = {}
    for z, e in zip(zh_t, en_t):
        if z != e and re.search(r"[\u4e00-\u9fff]", z):
            out[z] = e
    return out


def main() -> None:
    zh_html = ZH.read_text(encoding="utf-8")
    en_html = EN.read_text(encoding="utf-8")
    zh_js = read_main_js(zh_html)
    en_js = read_main_js(en_html)
    js_lookup = pair_strings(extract_js_strings(zh_js), extract_js_strings(en_js))
    static_lookup = extract_static_pairs(zh_html, en_html)
    lookup_en = {**static_lookup, **js_lookup}

    zh_bundle = {
        "meta": {
            "title": "Token 投资收益 · AI Data Center",
            "description": "AI 数据中心 Token 服务投资收益分析：昇腾 NPU CAPEX/OPEX 与公有云 API 比价。",
        },
        "page": {
            "eyebrow": "Investment ROI",
            "h1": "Token 服务投资收益分析",
            "introHtml": "以<strong class=\"font-semibold text-slate-800\">算力规模（P）</strong>与<strong class=\"font-semibold text-slate-800\">集群功率（MW）</strong>联动建模，左侧 CAPEX、右侧 OPEX，中部比价图实时反映竞争力。",
        },
        "lookup": {k: k for k in lookup_en},
    }
    en_bundle = {
        "meta": {
            "title": "Token Investment ROI · AI Data Center",
            "description": "AI data center token service investment ROI: Ascend NPU CAPEX/OPEX vs public cloud API pricing.",
        },
        "page": {
            "eyebrow": "Investment ROI",
            "h1": "Token Service Investment ROI",
            "introHtml": "Models <strong class=\"font-semibold text-slate-800\">compute scale (P)</strong> and <strong class=\"font-semibold text-slate-800\">cluster power (MW)</strong> together — CAPEX on the left, OPEX on the right, with live price comparison in the center.",
        },
        "lookup": lookup_en,
    }

    for path, data in [
        (ROOT / "i18n" / "aidc-investment-roi.zh.json", zh_bundle),
        (ROOT / "i18n" / "aidc-investment-roi.en.json", en_bundle),
    ]:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(path, len(data["lookup"]), "lookup keys")


if __name__ == "__main__":
    raise SystemExit("DEPRECATED: en/ 已移除，请直接编辑 i18n/*.en.json。")
