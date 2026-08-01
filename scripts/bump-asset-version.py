#!/usr/bin/env python3
"""Bump release metadata and sync ?v= across all HTML + shared assets."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "data" / "asset-version.json"
RELEASE_FILE = ROOT / "data" / "site-release.json"
ASSET_VERSION_JS = ROOT / "js" / "aidc-asset-version.js"
FALLBACK_RE = re.compile(r"var FALLBACK = '\d+';")
LOCAL_ASSET_RE = re.compile(
    r'(?P<prefix>(?:src|href)=")((?:\.\./)?(?:js|css|i18n)/[^"?#]+)(?P<q>\?v=\d+)?(?P<suffix>")',
    re.IGNORECASE,
)
INFERENCE_STYLE_RE = re.compile(r'(?P<prefix>href="styles\.css)(?:\?v=\d+)?(?P<suffix>")')
ASSET_SCRIPT_MARK = "js/aidc-asset-version.js"


def asset_script_line(version: str, prefix: str = "") -> str:
    return f'  <script src="{prefix}js/aidc-asset-version.js?v={version}"></script>\n'


def load_version() -> str:
    data = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    return str(data["version"])


def save_version(version: str) -> None:
    payload = {"version": version, "updatedAt": date.today().isoformat()}
    VERSION_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sync_site_release(version)


def sync_site_release(asset_version: str) -> None:
    today = date.today()
    release = {
        "version": f"v{today.strftime('%Y.%m.%d')}",
        "build": asset_version,
        "updatedAt": today.isoformat(),
        "siteUrl": "https://www.aidc2026.cn",
        "repoUrl": "https://github.com/leodus2015-crypto/aidc2026",
    }
    RELEASE_FILE.write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def bump_version() -> str:
    current = int(load_version())
    new_v = str(current + 1)
    save_version(new_v)
    return new_v


def sync_asset_version_js(version: str) -> bool:
    text = ASSET_VERSION_JS.read_text(encoding="utf-8")
    new_text, n = FALLBACK_RE.subn(f"var FALLBACK = '{version}';", text, count=1)
    if n != 1:
        print(f"错误：无法在 {ASSET_VERSION_JS} 中更新 FALLBACK", file=sys.stderr)
        sys.exit(1)
    if new_text != text:
        ASSET_VERSION_JS.write_text(new_text, encoding="utf-8")
        return True
    return False


def patch_html_file(path: Path, version: str) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    text = text.replace("js/aidc-asset-version.js?v={v}", f"js/aidc-asset-version.js?v={version}")

    def repl(match: re.Match[str]) -> str:
        prefix = match.group("prefix")
        asset = match.group(2)
        suffix = match.group("suffix")
        return f'{prefix}{asset}?v={version}{suffix}'

    text = LOCAL_ASSET_RE.sub(repl, text)
    text = INFERENCE_STYLE_RE.sub(
        lambda match: f'{match.group("prefix")}?v={version}{match.group("suffix")}',
        text,
    )

    if ASSET_SCRIPT_MARK not in text and re.search(r'src="(?:\.\./)?js/', text):
        relative = path.relative_to(ROOT)
        depth = max(0, len(relative.parents) - 1)
        prefix = "../" * depth
        text = re.sub(
            r'(<script\s+[^>]*src="(?:\.\./)?js/[^"]+"[^>]*>\s*</script>\n)',
            lambda m: asset_script_line(version, prefix) + m.group(1),
            text,
            count=1,
        )

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def sync_all(version: str | None = None) -> str:
    v = version or load_version()
    sync_asset_version_js(v)
    changed = 0
    for html in sorted(ROOT.rglob("*.html")):
        if patch_html_file(html, v):
            changed += 1
    print(f"✓ asset version = {v}（已同步 {changed} 个 HTML + aidc-asset-version.js）")
    return v


def main() -> int:
    parser = argparse.ArgumentParser(description="全站静态资源 cache-bust 版本号")
    parser.add_argument("--bump", action="store_true", help="版本号 +1 并同步")
    parser.add_argument("--sync", action="store_true", help="按 asset-version.json 同步 HTML/JS（不递增）")
    parser.add_argument("--show", action="store_true", help="打印当前版本")
    args = parser.parse_args()

    if args.show:
        print(load_version())
        return 0

    if args.bump:
        v = bump_version()
        sync_all(v)
        return 0

    if args.sync:
        sync_all()
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
