#!/usr/bin/env python3
"""Write a localhost-only admin token file from .env for 8011 preview unlock."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "data" / "local-dev-admin.json"


def read_admin_token() -> str:
    env = (os.getenv("ADMIN_TOKEN") or "").strip()
    if env:
        return env
    path = ROOT / ".env"
    if not path.is_file():
        return ""
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == "ADMIN_TOKEN":
            return value.strip().strip("'").strip('"')
    return ""


def write_local_dev_admin(token: str, dest: Path = DEST) -> Path | None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not token:
        if dest.exists():
            dest.unlink()
        return None
    dest.write_text(json.dumps({"token": token}, ensure_ascii=False) + "\n", encoding="utf-8")
    return dest


def main() -> int:
    dest = write_local_dev_admin(read_admin_token())
    if dest is None:
        print("local-dev-admin: skipped (no ADMIN_TOKEN)", flush=True)
        return 0
    print(f"local-dev-admin: wrote {dest.relative_to(ROOT)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
