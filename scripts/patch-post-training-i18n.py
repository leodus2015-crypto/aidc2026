#!/usr/bin/env python3
"""Patch post-training.html for scheme B i18n."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "post-training.html"
JSON_ZH = ROOT / "i18n" / "post-training.zh.json"

HELPER = """
    function L(s) {
      if (!s || !window.AidcI18n) return s;
      return AidcI18n.getLookupText(s);
    }
    function localeTag() {
      return AidcI18n && AidcI18n.getLocale() === 'en' ? 'en-US' : 'zh-CN';
    }
    function applyPostTrainingStaticI18n() {
      document.querySelectorAll('[data-pt-i18n]').forEach(function (el) {
        var key = el.getAttribute('data-pt-i18n');
        if (key) el.textContent = L(key);
      });
      document.querySelectorAll('option[data-pt-i18n]').forEach(function (el) {
        var key = el.getAttribute('data-pt-i18n');
        if (key) el.textContent = L(key);
      });
    }
    function refreshPostTrainingI18n() {
      applyPostTrainingStaticI18n();
      if (typeof generateQuestionButtons === 'function') generateQuestionButtons();
      if (typeof updateFlowNodes === 'function') updateFlowNodes();
    }
"""

BOOTSTRAP = """
  <script src="js/aidc-locale-bridge.js"></script>
  <script src="js/i18n.js"></script>
  <script src="js/lang-switch.js"></script>
  <script src="js/i18n-bootstrap.js"></script>
  <script>
    AidcI18nBootstrap.bootstrap('post-training', {
      onReady: function () { refreshPostTrainingI18n(); },
      onLocaleChange: function () { refreshPostTrainingI18n(); },
    });
    if (window.AidcLocaleBridge) {
      AidcLocaleBridge.initIframeListener(function (locale) {
        if (window.AidcI18n && AidcI18n.getLocale() !== locale) {
          AidcI18n.setLocale(locale, { page: 'post-training', common: true, basePath: 'i18n/' });
        }
      }, { selfSource: 'post-training' });
    }
  </script>
"""


def remove_duplicate_script(content: str) -> str:
    pattern = r"<script>\s*\n\s*// 全局状态.*?</script>"
    matches = list(re.finditer(pattern, content, re.S))
    if len(matches) >= 2:
        content = content[: matches[1].start()] + content[matches[1].end() :]
    return content


def extract_main_script(content: str) -> tuple[str, int, int]:
    m = re.search(r"(<script>\s*\n\s*// 全局状态.*?</script>)", content, re.S)
    if not m:
        raise SystemExit("main script not found")
    return m.group(1), m.start(1), m.end(1)


def attr_escape(s: str) -> str:
    return html.escape(s, quote=True)


def tag_static_i18n(content: str, lookup: dict[str, str]) -> str:
    head, rest = content.split("<script>", 1)
    demo_html = head
    for key in sorted(lookup.keys(), key=len, reverse=True):
        if key not in demo_html:
            continue
        esc = re.escape(key)
        attr = attr_escape(key)

        def add_attr(m: re.Match[str]) -> str:
            tag = m.group(1)
            if "data-pt-i18n" in tag:
                return m.group(0)
            return f'{tag} data-pt-i18n="{attr}">{key}{m.group(3)}'

        demo_html = re.sub(
            rf"(<([a-zA-Z][\w-]*)(?:\s[^>]*)?)>{esc}(</\2>)",
            add_attr,
            demo_html,
            count=1,
        )
        demo_html = re.sub(
            rf"(<option(?:\s[^>]*)?)>{esc}(</option>)",
            lambda m: f'{m.group(1)} data-pt-i18n="{attr}">{key}{m.group(2)}'
            if "data-pt-i18n" not in m.group(1)
            else m.group(0),
            demo_html,
            count=1,
        )
    return demo_html + "<script>" + rest


def wrap_js_strings(js: str, lookup: dict[str, str]) -> str:
    if "function L(s)" not in js:
        js = HELPER + js
    for key in sorted(lookup.keys(), key=len, reverse=True):
        if key not in js:
            continue
        esc = re.escape(key)
        js = re.sub(rf"'{esc}'", f"L('{key}')", js)
        js = re.sub(rf'"{esc}"', f'L("{key}")', js)
    js = js.replace("toLocaleString('zh-CN')", "toLocaleString(localeTag())")
    return js


def patch_nav_footer(content: str) -> str:
    content = content.replace(
        '<body class="min-h-screen bg-slate-50 text-slate-900">',
        '<body class="min-h-screen bg-slate-50 text-slate-900" data-i18n-page="post-training">',
    )
    content = content.replace('aria-label="主导航"', 'data-i18n-aria-label="nav.aria" aria-label="主导航"')
    content = content.replace(
        'aria-label="AIDC 2026 · 首页"',
        'data-i18n-aria-label="nav.homeAria" aria-label="AIDC 2026 · 首页"',
    )

    nav = [
        ('index.html#inference', 'nav.inference', 'Agentic推理'),
        ('post-training.html', 'nav.postTraining', '后训练'),
        ('ai-dc-design.html', 'nav.aiDcLayout', 'AI DC布局'),
        ('white-paper.html', 'nav.whitePaper', '白皮书'),
        ('about-us.html', 'nav.aboutUs', 'About US'),
    ]
    for href, key, text in nav:
        content = re.sub(
            rf'(<a\s[^>]*href="{re.escape(href)}"[^>]*)\s*>\s*{re.escape(text)}\s*(</a>)',
            rf'\1 data-i18n="{key}">{text}\2',
            content,
            count=1,
            flags=re.S,
        )

    old_footer = """  <footer class="border-t border-slate-200 bg-white py-6">
    <p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-slate-500">
      <span>工信部备案号：
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="transition hover:text-slate-700"
        >苏ICP备2026026790号-3</a>
      </span>
      <span class="hidden sm:inline" aria-hidden="true">|</span>
      <span>公安备案号：
        <a
          href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=32010602012455"
          target="_blank"
          rel="noopener noreferrer"
          class="transition hover:text-slate-700"
        >苏公网安备32010602012455号</a>
      </span>
    </p>
  </footer>"""
    new_footer = """  <footer class="border-t border-slate-200 bg-white py-6">
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
    return content.replace(old_footer, new_footer)


def main() -> None:
    lookup = json.loads(JSON_ZH.read_text(encoding="utf-8"))["lookup"]
    content = HTML.read_text(encoding="utf-8")
    content = remove_duplicate_script(content)
    content = patch_nav_footer(content)
    content = tag_static_i18n(content, lookup)

    script_block, start, end = extract_main_script(content)
    inner = re.match(r"<script>(.*)</script>", script_block, re.S).group(1)
    inner = wrap_js_strings(inner, lookup)
    content = content[:start] + f"<script>{inner}</script>" + content[end:]

    content = re.sub(
        r'  <script src="js/lang-switch.js"></script>\s*<script>AidcLangSwitch\.mount\(document\.getElementById\(\'lang-switch-root\'\)\);</script>',
        BOOTSTRAP.strip(),
        content,
        count=1,
    )

    HTML.write_text(content, encoding="utf-8")
    print("Patched", HTML, "lookup keys:", len(lookup))


if __name__ == "__main__":
    main()
