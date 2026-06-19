#!/usr/bin/env python3
"""DEPRECATED: en/ 已移除。请直接编辑 i18n/datacenter-3d-*.en.json。"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PAGES = [
    {
        "page_id": "datacenter-3d-case-b",
        "zh": ROOT / "datacenter-3d-case-b.html",
        "en": ROOT / "en" / "datacenter-3d-case-b.html",
        "meta_zh": {
            "title": "DataCenter 3D 设计器 · 案例A（风冷超节点）",
            "description": "数据中心 3D 机柜布局设计器 · 案例A（风冷超节点）",
        },
        "meta_en": {
            "title": "DataCenter 3D Designer · Case A (Air-Cooled Supernode)",
            "description": "Data center 3D rack layout designer · Case A (Air-Cooled Supernode)",
        },
    },
    {
        "page_id": "datacenter-3d-v3-2",
        "zh": ROOT / "datacenter-3d-v3 2.html",
        "en": ROOT / "en" / "datacenter-3d-v3 2.html",
        "meta_zh": {
            "title": "DataCenter 3D 设计器 · 案例B（风冷超节点）",
            "description": "数据中心 3D 机柜布局设计器 · 案例B（风冷超节点）",
        },
        "meta_en": {
            "title": "DataCenter 3D Designer · Case B (Air-Cooled Supernode)",
            "description": "Data center 3D rack layout designer · Case B (Air-Cooled Supernode)",
        },
    },
]


def extract_module_js(html: str) -> str:
    m = re.search(r'<script type="module">(.*?)</script>', html, re.S)
    return m.group(1) if m else ""


def all_strings(js: str) -> list[str]:
    return [m.group(2) for m in re.finditer(r"(['\"])(.*?)\1", js, re.S) if len(m.group(2)) < 200]


def static_pairs(zh_html: str, en_html: str) -> dict[str, str]:
    def pick(html: str) -> list[str]:
        chunk = re.sub(r"<script.*?</script>", "", html, flags=re.S)
        parts = re.findall(r">([^<>{}]+?)<", chunk[:12000])
        return [p.strip() for p in parts if p.strip() and len(p.strip()) < 100]

    out: dict[str, str] = {}
    for z, e in zip(pick(zh_html), pick(en_html)):
        if z != e and re.search(r"[\u4e00-\u9fff]", z):
            out[z] = e
    return out


def js_pairs(zh_js: str, en_js: str) -> dict[str, str]:
    zh_list, en_list = all_strings(zh_js), all_strings(en_js)
    n = min(len(zh_list), len(en_list))
    out: dict[str, str] = {}
    for z, e in zip(zh_list[:n], en_list[:n]):
        if re.search(r"[\u4e00-\u9fff]", z) and z != e:
            out[z] = e
    return out


def build_page(page: dict) -> None:
    zh_html = page["zh"].read_text(encoding="utf-8")
    en_html = page["en"].read_text(encoding="utf-8")
    lookup = static_pairs(zh_html, en_html)
    lookup.update(js_pairs(extract_module_js(zh_html), extract_module_js(en_html)))

    pid = page["page_id"]
    for loc, meta in [("zh", page["meta_zh"]), ("en", page["meta_en"])]:
        lookup_map = lookup if loc == "en" else {k: k for k in lookup}
        path = ROOT / "i18n" / f"{pid}.{loc}.json"
        data = {"meta": meta, "lookup": lookup_map}
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(path.name, len(lookup_map), "keys")


def main() -> None:
    for page in PAGES:
        build_page(page)


if __name__ == "__main__":
    raise SystemExit("DEPRECATED: en/ 已移除，请直接编辑 i18n/*.en.json。")
