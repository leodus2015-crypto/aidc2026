#!/usr/bin/env python3
"""Patch demo pages for scheme B i18n."""

from __future__ import annotations

import html as html_lib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HELPER = """
    function L(s) {
      if (!s || !window.AidcI18n) return s;
      return AidcI18n.getLookupText(s);
    }
    function applyPtI18nEl(el) {
      var key = el.getAttribute('data-pt-i18n');
      if (!key) return;
      var val = L(key);
      var tspans = el.querySelectorAll('tspan');
      if (tspans.length) {
        val.split('\\n').forEach(function (line, i) {
          if (tspans[i]) tspans[i].textContent = line;
        });
      } else {
        el.textContent = val;
      }
    }
    function applyDemoStaticI18n() {
      document.querySelectorAll('[data-pt-i18n]').forEach(applyPtI18nEl);
    }
"""

BOOTSTRAP_FLOOR = """
  <script src="js/aidc-locale-bridge.js"></script>
  <script src="js/i18n.js"></script>
  <script src="js/lang-switch.js"></script>
  <script src="js/i18n-bootstrap.js"></script>
  <script>
    AidcI18nBootstrap.bootstrap('ai-dc-floor-detail', {
      onReady: function () { applyDemoStaticI18n(); },
      onLocaleChange: function () { applyDemoStaticI18n(); },
    });
    if (window.AidcLocaleBridge) {
      AidcLocaleBridge.initIframeListener(function (locale) {
        if (window.AidcI18n && AidcI18n.getLocale() !== locale) {
          AidcI18n.setLocale(locale, { page: 'ai-dc-floor-detail', common: true, basePath: 'i18n/' });
        }
      }, { selfSource: 'ai-dc-floor-detail' });
    }
  </script>
"""

BOOTSTRAP_FOUR = """
  <script src="js/aidc-locale-bridge.js"></script>
  <script src="js/i18n.js"></script>
  <script src="js/lang-switch.js"></script>
  <script src="js/i18n-bootstrap.js"></script>
  <script>
    AidcI18nBootstrap.bootstrap('ai-dc-four-layer', {
      onReady: function () { if (typeof refreshFourLayerI18n === 'function') refreshFourLayerI18n(); },
      onLocaleChange: function () { if (typeof refreshFourLayerI18n === 'function') refreshFourLayerI18n(); },
    });
    if (window.AidcLocaleBridge) {
      AidcLocaleBridge.initIframeListener(function (locale) {
        if (window.AidcI18n && AidcI18n.getLocale() !== locale) {
          AidcI18n.setLocale(locale, { page: 'ai-dc-four-layer', common: true, basePath: 'i18n/' });
        }
      }, { selfSource: 'ai-dc-four-layer' });
    }
  </script>
"""


def attr_escape(s: str) -> str:
    return html_lib.escape(s, quote=True)


def tag_pt_i18n(content: str, lookup: dict[str, str]) -> str:
    head, rest = content.split("<script", 1)
    demo = head
    for key in sorted(lookup.keys(), key=len, reverse=True):
        if key not in demo:
            continue
        a = attr_escape(key)
        esc = re.escape(key)

        def add_text(m: re.Match[str]) -> str:
            tag = m.group(1)
            if "data-pt-i18n" in tag:
                return m.group(0)
            return f'{tag} data-pt-i18n="{a}">{key}{m.group(3)}'

        demo = re.sub(rf"(<text[^>]*?)>{esc}(</text>)", add_text, demo, count=0)

        # multiline text blocks matched by svg builder keys with newlines
        if "\n" in key:
            continue

    # multiline keys from svg
    for key in sorted(lookup.keys(), key=len, reverse=True):
        if "\n" not in key:
            continue
        parts = key.split("\n")
        if parts[0] not in demo:
            continue
        a = attr_escape(key)
        demo = re.sub(
            rf'(<text[^>]*>\s*(?:<tspan[^>]*>{re.escape(parts[0])}</tspan>.*?</text>))',
            lambda m: m.group(1).replace("<text", f'<text data-pt-i18n="{a}"', 1),
            demo,
            count=1,
            flags=re.S,
        )

    for key in sorted(lookup.keys(), key=len, reverse=True):
        if key not in demo or "\n" in key:
            continue
        esc = re.escape(key)
        demo = re.sub(
            rf"(<([a-zA-Z][\w-]*)(?:\s[^>]*)?)>{esc}(</\2>)",
            lambda m: f'{m.group(1)} data-pt-i18n="{attr_escape(key)}">{key}{m.group(3)}'
            if "data-pt-i18n" not in m.group(1)
            else m.group(0),
            demo,
            count=1,
        )
    return demo + "<script" + rest


def patch_nav(content: str, current_href: str | None = None) -> str:
    content = content.replace(
        '<body class="min-h-screen bg-slate-50 text-slate-900">',
        '<body class="min-h-screen bg-slate-50 text-slate-900" data-i18n-page="ai-dc-floor-detail">',
    )
    content = content.replace(
        '<body class="flex min-h-screen flex-col bg-slate-50 text-slate-900">',
        '<body class="flex min-h-screen flex-col bg-slate-50 text-slate-900" data-i18n-page="ai-dc-four-layer">',
    )
    content = content.replace('aria-label="主导航"', 'data-i18n-aria-label="nav.aria" aria-label="主导航"')
    content = content.replace('aria-label="Main navigation"', 'data-i18n-aria-label="nav.aria" aria-label="主导航"')
    content = content.replace(
        'aria-label="AIDC 2026 · 首页"',
        'data-i18n-aria-label="nav.homeAria" aria-label="AIDC 2026 · 首页"',
    )
    content = content.replace(
        'aria-label="AIDC 2026 · Home"',
        'data-i18n-aria-label="nav.homeAria" aria-label="AIDC 2026 · 首页"',
    )
    nav = [
        ("index.html#inference", "nav.inference", "Agentic推理", "Agentic Inference"),
        ("post-training.html", "nav.postTraining", "后训练", "Post-Training"),
        ("ai-dc-design.html", "nav.aiDcLayout", "AI DC布局", "AI DC Layout"),
        ("white-paper.html", "nav.whitePaper", "白皮书", "White Paper"),
    ]
    for href, key, zh, en in nav:
        for label in (zh, en):
            content = re.sub(
                rf'(<a\s[^>]*href="{re.escape(href)}"[^>]*)\s*>\s*{re.escape(label)}\s*(</a>)',
                rf'\1 data-i18n="{key}">{zh}\2',
                content,
                count=1,
            )
    if current_href:
        content = re.sub(
            rf'(<a\s[^>]*href="{re.escape(current_href)}"[^>]*class="[^"]*text-blue-700[^"]*")',
            r'\1 aria-current="page"',
            content,
            count=1,
        )
    return content


def patch_floor_detail() -> None:
    path = ROOT / "ai-dc-floor-detail.html"
    lookup = json.loads((ROOT / "i18n" / "ai-dc-floor-detail.zh.json").read_text(encoding="utf-8"))["lookup"]
    content = path.read_text(encoding="utf-8")
    content = patch_nav(content)
    content = tag_pt_i18n(content, lookup)
    if "function L(s)" not in content:
        content = content.replace(
            "<script src=\"js/lang-switch.js\"></script>",
            f"<script>{HELPER}</script>\n  <script src=\"js/lang-switch.js\"></script>",
        )
    content = re.sub(
        r'<script src="js/lang-switch.js"></script>\s*<script>AidcLangSwitch\.mount\(document\.getElementById\(\'lang-switch-root\'\)\);</script>',
        BOOTSTRAP_FLOOR.strip(),
        content,
        count=1,
    )
    path.write_text(content, encoding="utf-8")
    print("Patched", path.name)


def patch_four_layer() -> None:
    path = ROOT / "ai-dc-four-layer.html"
    content = path.read_text(encoding="utf-8")
    content = content.replace('<html lang="en">', '<html lang="zh-CN">')
    content = content.replace(
        "Four-Layer Data Center Schematic",
        "四层数据中心示意图",
    )
    content = content.replace(
        "Drag horizontally to turn · Scroll to zoom · Front-facing rotation",
        "左右拖动旋转 · 滚轮缩放 · 正面朝向旋转",
    )
    content = patch_nav(content)

    content = content.replace(
        """    const ZONES = {
      hvac: { label: 'Cooling', fill: '#e0f2fe', stroke: '#0284c7', text: '#0369a1' },
      server: { label: 'Server Hall', fill: '#e2e8f0', stroke: '#475569', text: '#334155' },
      electrical: { label: 'Electrical', fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
      hydraulic: { label: 'Hydraulic', fill: '#ccfbf1', stroke: '#0d9488', text: '#115e59' },
      battery: { label: 'Battery', fill: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' },
      cooling: { label: 'Cooling\\nTower', fill: '#dbeafe', stroke: '#2563eb', text: '#1d4ed8' },
      tbd: { label: 'TBD', fill: '#f8fafc', stroke: '#94a3b8', text: '#64748b', dash: '6 4' },
    };""",
        """    const ZONES = {
      hvac: { label: '制冷', fill: '#e0f2fe', stroke: '#0284c7', text: '#0369a1' },
      server: { label: '机房', fill: '#e2e8f0', stroke: '#475569', text: '#334155' },
      electrical: { label: '配电', fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
      hydraulic: { label: '水力', fill: '#ccfbf1', stroke: '#0d9488', text: '#115e59' },
      battery: { label: '电池', fill: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' },
      cooling: { label: '冷却塔', fill: '#dbeafe', stroke: '#2563eb', text: '#1d4ed8' },
      tbd: { label: '待定', fill: '#f8fafc', stroke: '#94a3b8', text: '#64748b', dash: '6 4' },
    };""",
    )

    content = content.replace(
        "const lines = (style.label + (uncertain ? '?' : '')).split('\\n');",
        "const lines = (L(style.label) + (uncertain ? '?' : '')).split('\\n');",
    )

    refresh_fn = """
    function refreshFourLayerI18n() {
      applyDemoStaticI18n();
      floorGroups.innerHTML = '';
      dimLines.innerHTML = '';
      floors.forEach(renderFloor);
      renderDims();
      fitViewBox();
    }
"""
    if "function refreshFourLayerI18n" not in content:
        content = content.replace(
            "    updateTransform();\n    animate();\n  </script>",
            f"    updateTransform();\n    animate();{refresh_fn}\n  </script>",
        )

    lookup = json.loads((ROOT / "i18n" / "ai-dc-four-layer.zh.json").read_text(encoding="utf-8"))["lookup"]
    content = tag_pt_i18n(content, lookup)

    if "function L(s)" not in content:
        content = content.replace("<script>\n    const ZONES", f"<script>{HELPER}\n    const ZONES")

    content = re.sub(
        r'<script src="js/lang-switch.js"></script>\s*<script>AidcLangSwitch\.mount\(document\.getElementById\(\'lang-switch-root\'\)\);</script>',
        BOOTSTRAP_FOUR.strip(),
        content,
        count=1,
    )
    path.write_text(content, encoding="utf-8")
    print("Patched", path.name)


def main() -> None:
    patch_floor_detail()
    patch_four_layer()


if __name__ == "__main__":
    main()
