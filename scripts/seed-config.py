#!/usr/bin/env python3
"""将 data/config-seeds/*.json 导入 MySQL app_config 表。"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api"))

from db import ping_database, upsert_config  # noqa: E402
from settings import database_configured  # noqa: E402

SEED_DIR = ROOT / "data" / "config-seeds"


def parse_only(raw: str | None) -> set[str] | None:
    if not raw:
        return None
    keys = {item.strip() for item in raw.split(",") if item.strip()}
    return keys or None


def main() -> int:
    parser = argparse.ArgumentParser(description="导入 config-seeds 到 app_config")
    parser.add_argument(
        "--only",
        help="只导入指定键，逗号分隔，例如 roi.defaults,roi.cloud_compare",
    )
    args = parser.parse_args()
    only = parse_only(args.only)

    if not database_configured():
        print("错误：请在 .env 中配置 DATABASE_HOST / DATABASE_USER / DATABASE_NAME", file=sys.stderr)
        return 1
    if not ping_database():
        print("错误：无法连接 MySQL，请检查 .env 与 sql/schema.sql", file=sys.stderr)
        return 1

    files = sorted(SEED_DIR.glob("*.json"))
    if only is not None:
        files = [path for path in files if path.stem in only]
        missing = only - {path.stem for path in files}
        if missing:
            print(f"错误：未找到种子文件：{', '.join(sorted(missing))}", file=sys.stderr)
            return 1
    if not files:
        print(f"未找到种子文件：{SEED_DIR}")
        return 1

    for path in files:
        config_key = path.stem
        data = json.loads(path.read_text(encoding="utf-8"))
        saved = upsert_config(config_key, data, updated_by="seed-script", force=True)
        print(f"✓ {config_key} (v{saved['version']})")

    print(f"完成，共导入 {len(files)} 项配置。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
