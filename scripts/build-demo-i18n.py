#!/usr/bin/env python3
"""Build i18n JSON for ai-dc-floor-detail and ai-dc-four-layer."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PAGES = [
    {
        "page_id": "ai-dc-floor-detail",
        "meta_zh": {
            "title": "单层详细平面图 · AI Data Center",
            "description": "AI 数据中心单层详细平面图：EHU 空调机房、风冷/液冷机房、配电与水力模块。",
        },
        "meta_en": {
            "title": "Single Floor Plan · AI Data Center",
            "description": "Single-floor AI data center plan: EHU HVAC rooms, air/liquid-cooled halls, power and hydraulic modules.",
        },
    },
]


def html_without_scripts(html: str) -> str:
    return re.sub(r"<script.*?</script>", "", html, flags=re.S)


def text_nodes(html: str) -> list[str]:
    chunk = html_without_scripts(html)
    parts = re.findall(r">([^<>{}]+?)<", chunk)
    out: list[str] = []
    for p in parts:
        t = " ".join(p.split())
        if t:
            out.append(t)
    return out


def svg_text_blocks(html: str) -> list[str]:
    chunk = html_without_scripts(html)
    blocks: list[str] = []
    for m in re.finditer(r"<text[^>]*>(.*?)</text>", chunk, re.S):
        inner = m.group(1)
        if "<tspan" in inner:
            spans = re.findall(r"<tspan[^>]*>([^<]*)</tspan>", inner)
            blocks.append("\n".join(spans))
        else:
            blocks.append(re.sub(r"\s+", " ", inner).strip())
    return blocks


def pair_lists(zh_list: list[str], en_list: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    n = min(len(zh_list), len(en_list))
    for z, e in zip(zh_list[:n], en_list[:n]):
        if z != e and re.search(r"[\u4e00-\u9fff]", z):
            out[z] = e
    return out


def build_floor_detail() -> None:
    page = PAGES[0]
    en_path = ROOT / "i18n" / f"{page['page_id']}.en.json"
    if not en_path.exists():
        print("Skip", page["page_id"], "(missing", en_path.name + ")")
        return
    lookup = json.loads(en_path.read_text(encoding="utf-8")).get("lookup", {})

    for loc, meta in [("zh", page["meta_zh"]), ("en", page["meta_en"])]:
        data = {"meta": meta, "lookup": lookup if loc == "en" else {k: k for k in lookup}}
        path = ROOT / "i18n" / f"{page['page_id']}.{loc}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(path.name, len(data["lookup"]), "keys")


def build_four_layer() -> None:
    lookup = {
        "四层数据中心示意图": "Four-Layer Data Center Schematic",
        "左右拖动旋转 · 滚轮缩放 · 正面朝向旋转": "Drag horizontally to turn · Scroll to zoom · Front-facing rotation",
        "制冷": "Cooling",
        "机房": "Server Hall",
        "配电": "Electrical",
        "水力": "Hydraulic",
        "电池": "Battery",
        "冷却塔": "Cooling\nTower",
        "待定": "TBD",
    }
    meta_zh = {
        "title": "四层数据中心示意图 · AI Data Center",
        "description": "四层数据中心建筑示意：RF、3F、2F、1F 平面布局与层高标注。",
    }
    meta_en = {
        "title": "Four-Layer Data Center · AI Data Center",
        "description": "Four-layer data center building schematic: RF, 3F, 2F, 1F floor layouts and height annotations.",
    }
    for loc, meta in [("zh", meta_zh), ("en", meta_en)]:
        data = {"meta": meta, "lookup": lookup if loc == "en" else {k: k for k in lookup}}
        path = ROOT / "i18n" / f"ai-dc-four-layer.{loc}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(path.name, len(data["lookup"]), "keys")


def main() -> None:
    build_floor_detail()
    build_four_layer()


if __name__ == "__main__":
    main()
