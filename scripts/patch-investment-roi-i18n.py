#!/usr/bin/env python3
"""Patch aidc-investment-roi.html for scheme B and wrap JS Chinese strings with L()."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "aidc-investment-roi.html"
JSON_ZH = ROOT / "i18n" / "aidc-investment-roi.zh.json"


def main() -> None:
    lookup = json.loads(JSON_ZH.read_text(encoding="utf-8"))["lookup"]
    html = HTML.read_text(encoding="utf-8")

    html = html.replace(
        '<body class="min-h-screen bg-slate-50 text-slate-900">',
        '<body class="min-h-screen bg-slate-50 text-slate-900" data-i18n-page="aidc-investment-roi">',
    )
    html = html.replace('aria-label="主导航"', 'data-i18n-aria-label="nav.aria" aria-label="主导航"')
    html = html.replace(
        'aria-label="AIDC 2026 · 首页"',
        'data-i18n-aria-label="nav.homeAria" aria-label="AIDC 2026 · 首页"',
    )

    nav_items = [
        ("index.html#inference", "nav.inference", "Agentic推理"),
        ("post-training.html", "nav.postTraining", "后训练"),
        ("ai-dc-design.html", "nav.aiDcLayout", "AI DC布局"),
        ("white-paper.html", "nav.whitePaper", "白皮书"),
        ("about-us.html", "nav.aboutUs", "About US"),
    ]
    for href, key, text in nav_items:
        html = re.sub(
            rf'(<a href="{re.escape(href)}" class="inline-block border-b-2 border-transparent pb-1 text-slate-600 transition hover:border-slate-300 hover:text-slate-950">){re.escape(text)}(</a>)',
            rf'\1 data-i18n="{key}">{text}\2',
            html,
            count=1,
        )

    html = re.sub(
        r'<p class="text-xs font-semibold uppercase tracking-\[0\.14em\] text-blue-600">Investment ROI</p>',
        '<p class="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600" data-i18n="page.eyebrow">Investment ROI</p>',
        html,
        count=1,
    )
    html = re.sub(
        r'<h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Token 服务投资收益分析</h1>',
        '<h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl" data-i18n="page.h1"></h1>',
        html,
        count=1,
    )
    html = re.sub(
        r'<p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg">\s*以<strong.*?</p>',
        '<p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg" data-i18n-html="page.introHtml"></p>',
        html,
        count=1,
        flags=re.S,
    )

    footer_old = """  <footer id="site-footer" class="border-t border-slate-200 bg-white py-6">
    <p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-slate-500">
      <span>工信部备案号：
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" class="transition hover:text-slate-700">苏ICP备2026026790号-3</a>
      </span>
      <span class="hidden sm:inline" aria-hidden="true">|</span>
      <span>公安备案号：
        <a href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=32010602012455" target="_blank" rel="noopener noreferrer" class="transition hover:text-slate-700">苏公网安备32010602012455号</a>
      </span>
    </p>
  </footer>"""
    footer_new = """  <footer id="site-footer" class="border-t border-slate-200 bg-white py-6">
    <p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-slate-500">
      <span><span data-i18n="footer.miit"></span>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" class="transition hover:text-slate-700">苏ICP备2026026790号-3</a>
      </span>
      <span class="hidden sm:inline" aria-hidden="true">|</span>
      <span><span data-i18n="footer.publicSecurity"></span>
        <a href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=32010602012455" target="_blank" rel="noopener noreferrer" class="transition hover:text-slate-700">苏公网安备32010602012455号</a>
      </span>
    </p>
  </footer>"""
    html = html.replace(footer_old, footer_new)

    helper = """
    function L(s) {
      if (!s || !window.AidcI18n) return s;
      return AidcI18n.getLookupText(s);
    }
    function localeTag() {
      return AidcI18n && AidcI18n.getLocale() === 'en' ? 'en-US' : 'zh-CN';
    }
"""
    html = html.replace(
        '<script src="js/config-loader.js"></script>\n  <script>\n',
        '<script src="js/config-loader.js"></script>\n  <script>\n' + helper,
        1,
    )

    # Wrap lookup strings longest-first to avoid partial replacements
    js = read_main_js(html)
    for zh in sorted(lookup.keys(), key=len, reverse=True):
        if zh not in js:
            continue
        esc = re.escape(zh)
        js = re.sub(rf"'{esc}'", f"L('{zh}')", js)
        js = re.sub(rf'"{esc}"', f'L("{zh}")', js)
    html = re.sub(
        r'(<script src="js/config-loader.js"></script>\s*<script>)(.*?)(</script>)',
        lambda m: m.group(1) + js + m.group(3),
        html,
        count=1,
        flags=re.S,
    )

    html = html.replace(
        "toLocaleString('zh-CN')",
        "toLocaleString(localeTag())",
    )

    html = html.replace(
        """  <script src="js/lang-switch.js"></script>
  <script>AidcLangSwitch.mount(document.getElementById('lang-switch-root'));</script>
""",
        """  <script src="js/aidc-locale-bridge.js"></script>
  <script src="js/i18n.js"></script>
  <script src="js/lang-switch.js"></script>
  <script src="js/i18n-bootstrap.js"></script>
  <script>
    AidcI18nBootstrap.bootstrap('aidc-investment-roi', {
      onReady: function () {
        if (typeof bootPage === 'function') bootPage();
      },
      onLocaleChange: function () {
        if (typeof renderAll === 'function') renderAll();
        if (typeof updateConfigSourceBadge === 'function') updateConfigSourceBadge();
        if (typeof updatePctSumHint === 'function') updatePctSumHint();
      },
    });
    if (window.AidcLocaleBridge) {
      AidcLocaleBridge.initIframeListener(function (locale) {
        if (window.AidcI18n && AidcI18n.getLocale() !== locale) {
          AidcI18n.setLocale(locale, { page: 'aidc-investment-roi', common: true, basePath: 'i18n/' });
        }
      }, { selfSource: 'aidc-investment-roi' });
    }
  </script>
""",
    )

    # bootPage() was called at end of inline script - remove duplicate call
    html = html.replace("\n    bootPage();\n  </script>", "\n  </script>", 1)

    HTML.write_text(html, encoding="utf-8")
    print("Patched", HTML)


def read_main_js(html: str) -> str:
    m = re.search(r'<script src="js/config-loader.js"></script>\s*<script>(.*?)</script>', html, re.S)
    return m.group(1) if m else ""


if __name__ == "__main__":
    main()
