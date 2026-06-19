#!/usr/bin/env python3
"""DEPRECATED: en/ 目录已移除。英文文案请维护 i18n/*.en.json。"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_DIR = ROOT / "en"

# 按长度降序替换，避免短串误伤
REPLACEMENTS: list[tuple[str, str]] = [
    # Nav & site chrome
    ('aria-label="主导航"', 'aria-label="Main navigation"'),
    ('aria-label="AIDC 2026 · 首页"', 'aria-label="AIDC 2026 · Home"'),
    ("Agentic推理", "Agentic Inference"),
    ("后训练", "Post-Training"),
    ("AI DC布局", "AI DC Layout"),
    ("白皮书", "White Paper"),
    ("布局与规划", "Layout & planning"),
    ("案例A（风冷超节点）", "Case A (Air-Cooled Supernode)"),
    ("案例B（风冷超节点）", "Case B (Air-Cooled Supernode)"),
    ("AI DC规划", "AI DC Planning"),
    ("工信部备案号：", "MIIT ICP filing: "),
    ("公安备案号：", "Public security filing: "),
    ("配置来源：加载中…", "Config source: loading…"),
    ("配置来源：本地缓存", "Config source: local cache"),
    ("配置来源：云数据库", "Config source: cloud database"),
    ("配置来源：本地默认", "Config source: local defaults"),
    ("输入访问密码", "Enter access password"),
    ("解锁布局或规则需验证身份（不区分大小写）。", "Unlock layout or rules after verification (case-insensitive)."),
    ("密码", "Password"),
    ("密码错误，请重试。", "Incorrect password. Try again."),
    ("取消", "Cancel"),
    ("确认", "Confirm"),
    ("解锁", "Unlock"),
    ("已解锁", "Unlocked"),
    ("提交", "Submit"),
    ("更新布局", "Apply layout"),
    ("布局", "Layout"),
    ("规则", "Rules"),
    ("视图", "Views"),
    ("俯视", "Top"),
    ("水平", "Side"),
    ("透视", "Perspective"),
    ("类型", "Type"),
    ("功率", "Power"),
    ("机房结构", "Room layout"),
    ("排数", "Rows"),
    ("每排机柜数", "Racks per row"),
    ("冷通道 (m)", "Cold aisle (m)"),
    ("热通道 (m)", "Hot aisle (m)"),
    ("机柜深度 (m)", "Rack depth (m)"),
    ("机柜高度 (U)", "Rack height (U)"),
    ("机柜尺寸", "Rack dimensions"),
    ("机柜功耗", "Rack power"),
    ("已恢复上次的配置", "Restored previous configuration"),
    ("已加载云端配置", "Loaded cloud configuration"),
    ("布局参数已解锁", "Layout parameters unlocked"),
    ("布局已更新并保存", "Layout updated and saved"),
    ("规则已解锁", "Rules unlocked"),
    ("规则已提交并保存", "Rules submitted and saved"),
    ("重定向至容量规划 · AI Data Center", "Redirect to capacity planning · AI Data Center"),
    ("容量规划内容已合并至首页 Agentic 推理下方。", "Capacity planning is merged below Agentic Inference on the home page."),
    ('前往「容量规划」区块', 'Go to “Capacity planning” section'),
    ("重定向至说明文档 · AI Data Center", "Redirect to documentation · AI Data Center"),
    ("说明文档已合并至首页第三部分。", "Documentation is merged into section 3 on the home page."),
    ('前往「说明文档」区块', 'Go to “Documentation” section'),
    ("页面未找到 · AI Data Center", "Page not found · AI Data Center"),
    ("抱歉，您访问的页面不存在。", "Sorry, the page you requested does not exist."),
    ("返回首页", "Back to home"),
    ("大模型推理HBM需求", "LLM Inference HBM Requirements"),
    ("Token 服务投资收益分析", "Token Service Investment ROI"),
    ("配置来源：云端数据库（全量同步）", "Config source: cloud database (fully synced)"),
    ("配置来源：部分云端 + 部分本地默认", "Config source: partial cloud + partial local defaults"),
    ("配置来源：本地默认（数据库不可用或未配置）", "Config source: local defaults (database unavailable or not configured)"),
    ("输入访问密码", "Enter access password"),
    ("开启「关键参数」需验证身份（不区分大小写）。", "Enable key parameters after verification (case-insensitive)."),
    ("关于我们", "About Us"),
    ("站点使命", "Mission"),
    ("开发团队", "Development team"),
    ("AI 使用说明", "AI usage notes"),
    ("代码量统计", "Code volume stats"),
]

ASSET_PREFIX_PATTERN = re.compile(
    r'(?P<attr>(?:href|src|action)=["\'])(?!(?:https?:|#|mailto:|javascript:|\.\./|/))',
    re.IGNORECASE,
)

LANG_SWITCH_SNIPPET = """
      <div id="lang-switch-root" class="ml-auto shrink-0"></div>"""

LANG_SWITCH_SCRIPT = """
  <script src="../js/lang-switch.js"></script>
  <script>AidcLangSwitch.mount(document.getElementById('lang-switch-root'));</script>"""

SKIP_FILES = {".DS_Store"}


def patch_nav(html: str) -> str:
    if 'id="lang-switch-root"' not in html and 'aria-label="主导航"' in html:
        html = html.replace(
            "      </ul>\n    </nav>",
            "      </ul>\n" + LANG_SWITCH_SNIPPET + "\n    </nav>",
            1,
        )
    if "AidcLangSwitch.mount" not in html and 'id="lang-switch-root"' in html:
        html = html.replace("</body>", LANG_SWITCH_SCRIPT + "\n</body>", 1)
    return html


def fix_asset_paths(html: str) -> str:
    def repl(m: re.Match[str]) -> str:
        return m.group("attr") + "../" + html[m.end() : m.end() + 1]  # noqa: invalid - fix below

    def sub_attr(match: re.Match[str]) -> str:
        prefix = match.group(1)
        path = match.group(2)
        if path.startswith("../") or "://" in path or path.startswith("/"):
            return match.group(0)
        return f'{prefix}../{path}'

    html = re.sub(r'((?:href|src)=["\'])(?!https?:|#|mailto:|javascript:|\.\./|/)([^"\']+)(["\'])', sub_attr, html)
    return html


def translate_content(text: str) -> str:
    for zh, en in REPLACEMENTS:
        text = text.replace(zh, en)
    text = text.replace('lang="zh-CN"', 'lang="en"')
    return text


def generate_one(src: Path) -> None:
    rel = src.name
    dst = EN_DIR / rel
    raw = src.read_text(encoding="utf-8")
    out = translate_content(raw)
    out = fix_asset_paths(out)
    out = patch_nav(out)
    if 'lang-switch-root' not in out and '#topbar' in out:
        out = out.replace(
            '<button id="sidebar-toggle">',
            '<div id="lang-switch-root" class="lang-switch-topbar"></div>\n  <button id="sidebar-toggle">',
            1,
        )
        if "AidcLangSwitch.mount" not in out:
            script = '\n<script src="../js/lang-switch.js"></script>\n<script>AidcLangSwitch.mount(document.getElementById("lang-switch-root"));</script>\n'
            out = out.replace("</body>", script + "</body>", 1)
    dst.write_text(out, encoding="utf-8")
    print(f"✓ en/{rel}")


def patch_chinese_nav(src: Path) -> None:
    text = src.read_text(encoding="utf-8")
    original = text
    if 'aria-label="主导航"' in text and 'id="lang-switch-root"' not in text:
        text = text.replace(
            "      </ul>\n    </nav>",
            "      </ul>\n      <div id=\"lang-switch-root\" class=\"ml-auto shrink-0\"></div>\n    </nav>",
            1,
        )
    if 'id="lang-switch-root"' in text and "AidcLangSwitch.mount" not in text:
        snippet = '\n  <script src="js/lang-switch.js"></script>\n  <script>AidcLangSwitch.mount(document.getElementById(\'lang-switch-root\'));</script>\n'
        text = text.replace("</body>", snippet + "</body>", 1)
    if text != original:
        src.write_text(text, encoding="utf-8")
        print(f"↻ {src.name} (lang switch)")


def main() -> int:
    EN_DIR.mkdir(exist_ok=True)
    html_files = sorted(p for p in ROOT.glob("*.html") if p.name not in SKIP_FILES)
    for path in html_files:
        patch_chinese_nav(path)
        generate_one(path)
    print(f"Done. Generated {len(html_files)} English pages in en/")
    return 0


if __name__ == "__main__":
    raise SystemExit("DEPRECATED: en/ 已移除，请直接编辑 i18n/*.en.json。")
