#!/usr/bin/env python3
"""DEPRECATED: en/ 已移除。请直接编辑 i18n/post-training.en.json。"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZH = ROOT / "post-training.html"
EN = ROOT / "en" / "post-training.html"


def html_without_scripts(html: str) -> str:
    return re.sub(r"<script.*?</script>", "", html, flags=re.S)


def all_script_js(html: str) -> str:
    parts = []
    for m in re.finditer(r"<script(?:\s[^>]*)?>(.*?)</script>", html, re.S):
        body = m.group(1)
        if "tailwind" in m.group(0) or "lang-switch" in body:
            continue
        if len(body.strip()) > 500:
            parts.append(body)
    return "\n".join(parts)


def all_strings(text: str) -> list[str]:
    return [m.group(2) for m in re.finditer(r"(['\"])(.*?)\1", text, re.S) if 0 < len(m.group(2)) < 300]


def static_pairs(zh_html: str, en_html: str) -> dict[str, str]:
    def pick(html: str) -> list[str]:
        chunk = html_without_scripts(html)
        parts = re.findall(r">([^<>{}]+?)<", chunk)
        return [p.strip() for p in parts if p.strip()]

    out: dict[str, str] = {}
    zh_parts, en_parts = pick(zh_html), pick(en_html)
    n = min(len(zh_parts), len(en_parts))
    for z, e in zip(zh_parts[:n], en_parts[:n]):
        if z != e and re.search(r"[\u4e00-\u9fff]", z):
            out[z] = e
    return out


def js_pairs(zh_html: str, en_html: str) -> dict[str, str]:
    zh_js, en_js = all_script_js(zh_html), all_script_js(en_html)
    zlist, elist = all_strings(zh_js), all_strings(en_js)
    n = min(len(zlist), len(elist))
    out: dict[str, str] = {}
    for z, e in zip(zlist[:n], elist[:n]):
        if re.search(r"[\u4e00-\u9fff]", z) and z != e:
            out[z] = e
    return out


def main() -> None:
    zh_html = ZH.read_text(encoding="utf-8")
    en_html = EN.read_text(encoding="utf-8")
    lookup_en = static_pairs(zh_html, en_html)
    lookup_en.update(js_pairs(zh_html, en_html))

    zh_bundle = {
        "meta": {
            "title": "后训练 · 强化学习训练流程 · AI Data Center",
            "description": "后训练 · 强化学习训练流程演示（数据制作、模型准备、参数配置、训练与评测）。",
        },
        "lookup": {k: k for k in lookup_en},
    }
    en_bundle = {
        "meta": {
            "title": "Post-Training · RL Training Flow · AI Data Center",
            "description": "Post-training · RL training flow demo (data prep, model setup, configuration, training, and evaluation).",
        },
        "lookup": lookup_en,
    }

    for path, data in [
        (ROOT / "i18n" / "post-training.zh.json", zh_bundle),
        (ROOT / "i18n" / "post-training.en.json", en_bundle),
    ]:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(path.name, len(data["lookup"]), "lookup keys")


if __name__ == "__main__":
    raise SystemExit("DEPRECATED: en/ 已移除，请直接编辑 i18n/*.en.json。")
