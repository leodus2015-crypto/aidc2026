#!/usr/bin/env python3
"""Patch datacenter 3D HTML for scheme B i18n (ES module scripts)."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PAGES = [
    ("datacenter-3d-case-b", ROOT / "datacenter-3d-case-b.html"),
    ("datacenter-3d-v3-2", ROOT / "datacenter-3d-v3-2.html"),
]

HELPER = """
const L = (s) => (globalThis.AidcI18n?.getLookupText?.(s) ?? s);
const localeTag = () => (globalThis.AidcI18n?.getLocale?.() === 'en' ? 'en-US' : 'zh-CN');
function refreshDatacenterI18n() {
  if (typeof renderRules === 'function') renderRules();
  if (typeof updateViewList === 'function') updateViewList();
  if (typeof updateConfigSourceBadge === 'function') updateConfigSourceBadge();
  if (typeof updateStats === 'function') updateStats();
  if (typeof updateRowFilter === 'function') updateRowFilter();
}
"""


def extract_module(html: str) -> str:
    m = re.search(r"<script type=\"module\">(.*?)</script>", html, re.S)
    return m.group(1) if m else ""


def patch(html_path: Path, page_id: str) -> None:
    lookup = json.loads((ROOT / "i18n" / f"{page_id}.zh.json").read_text(encoding="utf-8"))["lookup"]
    html = html_path.read_text(encoding="utf-8")

    if "data-i18n-page" not in html:
        html = html.replace("<body>", f'<body data-i18n-page="{page_id}">', 1)

    js = extract_module(html)
    if "const L = " not in js:
        js = HELPER + js

    for zh in sorted(lookup.keys(), key=len, reverse=True):
        if zh not in js:
            continue
        esc = re.escape(zh)
        js = re.sub(rf"'{esc}'", f"L('{zh}')", js)
        js = re.sub(rf'"{esc}"', f'L("{zh}")', js)

    js = js.replace("toLocaleString('zh-CN')", "toLocaleString(localeTag())")

    marker = '<script type="module">'
    start = html.find(marker)
    end = html.find("</script>", start)
    if start < 0 or end < 0:
        raise SystemExit(f"module script not found in {html_path}")
    html = html[: start + len(marker)] + js + html[end:]

    bootstrap = f'''  <script src="js/aidc-locale-bridge.js"></script>
  <script src="js/i18n.js"></script>
  <script src="js/lang-switch.js"></script>
  <script src="js/i18n-bootstrap.js"></script>
  <script>
    AidcI18nBootstrap.bootstrap('{page_id}', {{
      onReady: function () {{ refreshDatacenterI18n(); }},
      onLocaleChange: function () {{ refreshDatacenterI18n(); }},
    }});
    if (window.AidcLocaleBridge) {{
      AidcLocaleBridge.initIframeListener(function (locale) {{
        if (window.AidcI18n && AidcI18n.getLocale() !== locale) {{
          AidcI18n.setLocale(locale, {{ page: '{page_id}', common: false, basePath: 'i18n/' }});
        }}
      }}, {{ selfSource: '{page_id}' }});
    }}
  </script>'''

    if "AidcI18nBootstrap.bootstrap" not in html:
        html = html.replace(
            '  <script src="js/lang-switch.js"></script>\n  <script>AidcLangSwitch.mount(document.getElementById(\'lang-switch-root\'));</script>',
            bootstrap,
        )
    else:
        html = re.sub(
            r'  <script src="js/aidc-locale-bridge.js"></script>.*?selfSource: \'{page_id}\' \}\);\s*\}\s*</script>',
            bootstrap.strip(),
            html,
            count=1,
            flags=re.S,
        )

    html_path.write_text(html, encoding="utf-8")
    print("Patched", html_path.name, len(lookup), "lookup keys")


def main() -> None:
    for page_id, path in PAGES:
        patch(path, page_id)


if __name__ == "__main__":
    main()
