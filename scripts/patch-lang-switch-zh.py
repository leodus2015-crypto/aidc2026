#!/usr/bin/env python3
"""为中文根目录 HTML 注入语言切换组件。"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

NAV_WRAP_OLD = """      <ul class="flex flex-wrap items-center gap-6 text-sm font-semibold">"""
NAV_WRAP_NEW = """      <div class="ml-auto flex flex-wrap items-center gap-4">
        <ul class="flex flex-wrap items-center gap-6 text-sm font-semibold">"""

NAV_WRAP_CLOSE_OLD = """      </ul>
    </nav>"""
NAV_WRAP_CLOSE_NEW = """        </ul>
        <div id="lang-switch-root" class="shrink-0"></div>
      </div>
    </nav>"""

SCRIPT = """
  <script src="js/lang-switch.js"></script>
  <script>AidcLangSwitch.mount(document.getElementById('lang-switch-root'));</script>"""

TOPBAR_MARKER = '<button id="sidebar-toggle">'
TOPBAR_INJECT = """  <div id="lang-switch-root" class="lang-switch-topbar"></div>
  <button id="sidebar-toggle">"""

TOPBAR_STYLE = """
  .lang-switch-topbar { margin-left: auto; margin-right: 8px; display: flex; align-items: center; }
  #topbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
"""

SCRIPT_REL = """
  <script src="../js/lang-switch.js"></script>
  <script>AidcLangSwitch.mount(document.getElementById('lang-switch-root'));</script>"""


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    if 'aria-label="主导航"' in text and 'id="lang-switch-root"' not in text:
        if NAV_WRAP_OLD in text and NAV_WRAP_CLOSE_OLD in text:
            text = text.replace(NAV_WRAP_OLD, NAV_WRAP_NEW, 1)
            text = text.replace(NAV_WRAP_CLOSE_OLD, NAV_WRAP_CLOSE_NEW, 1)
        elif '      </ul>\n    </nav>' in text:
            text = text.replace(
                '      </ul>\n    </nav>',
                '      </ul>\n      <div id="lang-switch-root" class="ml-auto shrink-0"></div>\n    </nav>',
                1,
            )
        elif '      </ul>\n      <div id="lang-switch-root"' not in text and '</nav>' in text and 'aria-label="' in text:
            text = text.replace(
                '\n    </nav>',
                '\n      <div id="lang-switch-root" class="ml-auto shrink-0"></div>\n    </nav>',
                1,
            )

    if 'class="page-header"' in text and 'id="lang-switch-root"' not in text:
        text = text.replace(
            '<div class="click-hint">',
            '<div id="lang-switch-root" class="lang-switch-topbar" style="margin-left:auto;margin-right:8px"></div>\n<div class="click-hint">',
            1,
        )

    if 'class="hdr"' in text and 'id="lang-switch-root"' not in text:
        text = text.replace(
            '<div class="hdr-badges">',
            '<div id="lang-switch-root" class="lang-switch-topbar" style="margin-left:auto;margin-right:8px"></div>\n<div class="hdr-badges">',
            1,
        )

    if 'aria-label="Main navigation"' in text and 'id="lang-switch-root"' not in text and '      </ul>\n    </nav>' in text:
        text = text.replace(
            '      </ul>\n    </nav>',
            '      </ul>\n      <div id="lang-switch-root" class="ml-auto shrink-0"></div>\n    </nav>',
            1,
        )

    if path.name == 'whitepaper2026-outline.html' and 'id="lang-switch-root"' not in text:
        text = text.replace('<body>', '<body>\n  <div id="lang-switch-root" class="fixed top-3 right-3 z-50"></div>', 1)

    if '#topbar' in text and 'id="lang-switch-root"' not in text:
        if '.lang-switch-topbar' not in text and '</style>' in text:
            text = text.replace('</style>', TOPBAR_STYLE + '\n</style>', 1)
        if TOPBAR_MARKER in text:
            text = text.replace(TOPBAR_MARKER, TOPBAR_INJECT, 1)
        elif '<header id="topbar">' in text and '<span id="hint">' in text:
            text = text.replace(
                '<span id="hint">',
                '<div id="lang-switch-root" class="lang-switch-topbar"></div>\n    <span id="hint">',
                1,
            )

    if 'AidcLangSwitch.mount' not in text and 'id="lang-switch-root"' in text:
        script = SCRIPT if path.parent == ROOT else SCRIPT_REL
        text = text.replace('</body>', script + '\n</body>', 1)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> int:
    count = 0
    for path in sorted(ROOT.glob('*.html')):
        if patch_file(path):
            print(f'✓ {path.name}')
            count += 1
    print(f'Patched {count} Chinese pages.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
