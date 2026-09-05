#!/usr/bin/env python3
"""Static site checks: JSON, i18n keys, HTML local refs, config seeds, deploy excludes."""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parent.parent

# Redirect-only compatibility HTML pages have been removed.
REDIRECT_HTML: set[str] = set()

# Known extra ALLOWED_CONFIG_KEYS that have no file in data/config-seeds/.
SEEDLESS_CONFIG_KEYS: set[str] = set()

# Optional: leaf paths allowed to differ between *.zh.json and *.en.json.
I18N_KEY_WHITELIST: dict[str, set[str]] = {
    # "page-id": {"lookup.someLegacyKey"},
}

LOCAL_REF_ATTRS = ("src", "href")
SKIP_REF_PREFIXES = (
    "http://",
    "https://",
    "//",
    "mailto:",
    "javascript:",
    "data:",
    "#",
    "?",
)
ATTR_RE = re.compile(
    r"""(?:src|href)\s*=\s*['"]([^'"]+)['"]""",
    re.IGNORECASE,
)
I18N_PAGE_RE = re.compile(r'data-i18n-page="([^"]+)"')
EXCLUDE_RE = re.compile(r"""--exclude\s+['"]([^'"]+)['"]""")


def fail(errors: list[str]) -> int:
    if not errors:
        print("check-site: OK")
        return 0
    print(f"check-site: {len(errors)} issue(s)", file=sys.stderr)
    for item in errors:
        print(f"  - {item}", file=sys.stderr)
    return 1


def iter_json_files() -> Iterable[Path]:
    for folder in (ROOT / "i18n", ROOT / "data"):
        if not folder.is_dir():
            continue
        for path in folder.rglob("*.json"):
            if path.name.startswith("."):
                continue
            yield path


def flatten_keys(obj: Any, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    if isinstance(obj, dict):
        for name, value in obj.items():
            path = f"{prefix}.{name}" if prefix else str(name)
            keys.add(path)
            keys |= flatten_keys(value, path)
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            path = f"{prefix}[{index}]"
            keys |= flatten_keys(value, path)
    return keys


def check_json_parse(errors: list[str]) -> dict[Path, Any]:
    loaded: dict[Path, Any] = {}
    for path in iter_json_files():
        rel = path.relative_to(ROOT).as_posix()
        try:
            loaded[path] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"JSON 无法解析 {rel}: {exc}")
    return loaded


def check_i18n_pairs(errors: list[str], loaded: dict[Path, Any]) -> None:
    i18n_dir = ROOT / "i18n"
    zh_files = sorted(i18n_dir.glob("*.zh.json"))
    for zh_path in zh_files:
        stem = zh_path.name[: -len(".zh.json")]
        en_path = i18n_dir / f"{stem}.en.json"
        rel_zh = zh_path.relative_to(ROOT).as_posix()
        rel_en = en_path.relative_to(ROOT).as_posix()
        if en_path not in loaded:
            if not en_path.is_file():
                errors.append(f"缺少英文文案 {rel_en}（对应 {rel_zh}）")
            continue
        if zh_path not in loaded:
            continue
        zh_keys = flatten_keys(loaded[zh_path])
        en_keys = flatten_keys(loaded[en_path])
        allow = I18N_KEY_WHITELIST.get(stem, set())
        missing_en = sorted((zh_keys - en_keys) - allow)
        extra_en = sorted((en_keys - zh_keys) - allow)
        if missing_en:
            preview = ", ".join(missing_en[:8])
            more = f" 等 {len(missing_en)} 个" if len(missing_en) > 8 else ""
            errors.append(f"i18n 键缺失于 {rel_en}: {preview}{more}")
        leftover_lookup = [k for k in extra_en if k.startswith("lookup.")]
        extra_struct = [k for k in extra_en if not k.startswith("lookup.")]
        if leftover_lookup:
            print(f"check-site: 提示 {rel_en} 有 {len(leftover_lookup)} 个未使用 lookup 键（不失败）")
        if extra_struct:
            preview = ", ".join(extra_struct[:8])
            more = f" 等 {len(extra_struct)} 个" if len(extra_struct) > 8 else ""
            errors.append(f"i18n 结构键多余于 {rel_en}: {preview}{more}")


def should_skip_ref(ref: str) -> bool:
    value = ref.strip()
    if not value or value.startswith(SKIP_REF_PREFIXES):
        return True
    if value.startswith("{") or "cdn." in value or "unpkg.com" in value:
        return True
    path_only = value.split("?")[0].split("#")[0]
    suffix = Path(path_only).suffix.lower()
    if suffix not in {".js", ".css", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".html"}:
        return True
    return False


def check_html_refs(errors: list[str]) -> None:
    for html_path in sorted(ROOT.rglob("*.html")):
        rel = html_path.relative_to(ROOT).as_posix()
        if "/." in f"/{rel}" or rel.startswith("."):
            continue
        text = html_path.read_text(encoding="utf-8")
        for raw in ATTR_RE.findall(text):
            if should_skip_ref(raw):
                continue
            path_only = raw.split("?")[0].split("#")[0]
            target = (html_path.parent / path_only).resolve()
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                continue
            if not target.is_file():
                errors.append(f"{rel} 引用缺失: {raw}")

        page_id = None
        match = I18N_PAGE_RE.search(text)
        if match:
            page_id = match.group(1)
        if rel in REDIRECT_HTML:
            continue
        if not page_id:
            errors.append(f"{rel} 缺少 data-i18n-page")
            continue
        for locale in ("zh", "en"):
            bundle = ROOT / "i18n" / f"{page_id}.{locale}.json"
            if not bundle.is_file():
                errors.append(f"{rel} data-i18n-page={page_id} 缺少 {bundle.relative_to(ROOT).as_posix()}")


def _frozenset_literals(node: ast.AST) -> set[str] | None:
    if not isinstance(node, ast.Call) or not node.args:
        return None
    arg0 = node.args[0]
    if isinstance(arg0, (ast.Set, ast.List, ast.Tuple)):
        return {ast.literal_eval(elt) for elt in arg0.elts}
    return None


def parse_allowed_config_keys() -> set[str]:
    text = (ROOT / "api" / "settings.py").read_text(encoding="utf-8")
    tree = ast.parse(text)
    for node in tree.body:
        value = None
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "ALLOWED_CONFIG_KEYS":
                    value = node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.target.id == "ALLOWED_CONFIG_KEYS":
                value = node.value
        if value is not None:
            keys = _frozenset_literals(value)
            if keys is not None:
                return keys
    raise RuntimeError("无法解析 ALLOWED_CONFIG_KEYS")


def check_config_seeds(errors: list[str]) -> None:
    try:
        allowed = parse_allowed_config_keys()
    except (OSError, RuntimeError, SyntaxError, ValueError) as exc:
        errors.append(f"无法读取 ALLOWED_CONFIG_KEYS: {exc}")
        return
    seed_dir = ROOT / "data" / "config-seeds"
    seed_keys: set[str] = set()
    if seed_dir.is_dir():
        for path in seed_dir.glob("*.json"):
            seed_keys.add(path.stem)
    unknown = sorted(seed_keys - allowed)
    if unknown:
        errors.append(f"config-seeds 不在 ALLOWED_CONFIG_KEYS: {', '.join(unknown)}")
    missing_seeds = sorted((allowed - SEEDLESS_CONFIG_KEYS) - seed_keys)
    if missing_seeds:
        errors.append(f"ALLOWED_CONFIG_KEYS 缺少种子文件: {', '.join(missing_seeds)}")


def extract_excludes(text: str) -> list[str]:
    return [item for item in EXCLUDE_RE.findall(text) if "$" not in item]


def check_deploy_excludes(errors: list[str]) -> None:
    sh_path = ROOT / "scripts" / "deploy.sh"
    yml_path = ROOT / ".github" / "workflows" / "deploy.yml"
    sh_ex = extract_excludes(sh_path.read_text(encoding="utf-8"))
    yml_ex = extract_excludes(yml_path.read_text(encoding="utf-8"))
    if sh_ex != yml_ex:
        errors.append(
            "deploy.sh 与 deploy.yml 的 --exclude 不一致: "
            f"sh={sh_ex} yml={yml_ex}"
        )


def main() -> int:
    errors: list[str] = []
    loaded = check_json_parse(errors)
    check_i18n_pairs(errors, loaded)
    check_html_refs(errors)
    check_config_seeds(errors)
    check_deploy_excludes(errors)
    return fail(errors)


if __name__ == "__main__":
    sys.exit(main())
