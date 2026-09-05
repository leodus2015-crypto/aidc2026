#!/usr/bin/env python3
"""Apply ordered SQL migrations. Fail-stop, checksum-protected, no production defaults."""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = ROOT / "sql" / "migrations"
FILENAME_RE = re.compile(r"^(\d{4})_[a-z0-9_]+\.sql$")


def checksum_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def list_migration_files(folder: Path = MIGRATIONS_DIR) -> list[Path]:
    if not folder.is_dir():
        raise FileNotFoundError(f"缺少迁移目录: {folder}")
    files = sorted(path for path in folder.glob("*.sql") if path.is_file())
    seen: dict[str, str] = {}
    ordered: list[Path] = []
    for path in files:
        match = FILENAME_RE.fullmatch(path.name)
        if not match:
            raise ValueError(f"迁移文件名无效: {path.name}")
        number = match.group(1)
        if number in seen:
            raise ValueError(f"迁移序号重复: {number} ({seen[number]}, {path.name})")
        seen[number] = path.name
        ordered.append(path)
    return ordered


def pending_migrations(available: Iterable[Path], applied: Iterable[str]) -> list[Path]:
    done = set(applied)
    return [path for path in available if path.name not in done]


def split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        current.append(line)
        if stripped.endswith(";"):
            statement = "\n".join(current).strip().rstrip(";").strip()
            if statement:
                statements.append(statement)
            current = []
    leftover = "\n".join(current).strip().rstrip(";").strip()
    if leftover:
        statements.append(leftover)
    return statements


def _ensure_registry(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename     VARCHAR(255) NOT NULL,
          checksum     CHAR(64) NOT NULL,
          applied_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )


def apply_migrations(dry_run: bool = False) -> int:
    sys.path.insert(0, str(ROOT / "api"))
    from db import db_connection  # noqa: E402
    from settings import database_configured  # noqa: E402

    if not database_configured():
        print("错误：请在 .env 中配置 DATABASE_HOST / DATABASE_USER / DATABASE_NAME", file=sys.stderr)
        return 1

    available = list_migration_files()
    with db_connection() as conn:
        with conn.cursor() as cur:
            _ensure_registry(cur)
            cur.execute("SELECT filename, checksum FROM schema_migrations")
            applied_rows = {row["filename"]: row["checksum"] for row in cur.fetchall()}

            for path in available:
                text = path.read_text(encoding="utf-8")
                digest = checksum_text(text)
                if path.name in applied_rows:
                    if applied_rows[path.name] != digest:
                        print(
                            f"错误：已应用迁移被改动 {path.name}（校验和不匹配）",
                            file=sys.stderr,
                        )
                        return 1
                    continue
                print(f"{'DRY-RUN' if dry_run else 'APPLY'} {path.name}")
                if dry_run:
                    continue
                for statement in split_sql_statements(text):
                    cur.execute(statement)
                cur.execute(
                    "INSERT INTO schema_migrations (filename, checksum) VALUES (%s, %s)",
                    (path.name, digest),
                )

    print("迁移完成。" if not dry_run else "预演完成，未写入数据库。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply AIDC SQL migrations")
    parser.add_argument("--dry-run", action="store_true", help="只列出待执行迁移，不连接写入")
    parser.add_argument("--check", action="store_true", help="只校验迁移文件名，不连接数据库")
    args = parser.parse_args()
    try:
        files = list_migration_files()
    except (OSError, ValueError) as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1
    if args.check or args.dry_run:
        label = "预演" if args.dry_run else "检查"
        print(f"{label}：迁移文件 {len(files)} 个，命名有效。")
        for path in files:
            print(f"  {path.name}")
        return 0
    return apply_migrations(dry_run=False)


if __name__ == "__main__":
    raise SystemExit(main())
