import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


def load_migrate():
    path = ROOT / "scripts" / "migrate.py"
    spec = importlib.util.spec_from_file_location("aidc_migrate", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_list_migration_files_accepts_repo_baselines():
    migrate = load_migrate()
    files = migrate.list_migration_files()
    names = [path.name for path in files]
    assert names[0] == "0001_schema_migrations.sql"
    assert "0002_baseline_app_config.sql" in names
    assert "0003_baseline_analytics.sql" in names


def test_list_migration_files_rejects_duplicate_numbers(tmp_path):
    migrate = load_migrate()
    (tmp_path / "0001_one.sql").write_text("SELECT 1;", encoding="utf-8")
    (tmp_path / "0001_two.sql").write_text("SELECT 2;", encoding="utf-8")
    with pytest.raises(ValueError, match="序号重复"):
        migrate.list_migration_files(tmp_path)


def test_pending_migrations_skips_applied():
    migrate = load_migrate()
    available = [
        Path("0001_schema_migrations.sql"),
        Path("0002_baseline_app_config.sql"),
    ]
    pending = migrate.pending_migrations(available, ["0001_schema_migrations.sql"])
    assert [path.name for path in pending] == ["0002_baseline_app_config.sql"]


def test_split_sql_statements_ignores_comments():
    migrate = load_migrate()
    statements = migrate.split_sql_statements(
        "-- note\nCREATE TABLE a (id INT);\nCREATE TABLE b (id INT);"
    )
    assert statements == ["CREATE TABLE a (id INT)", "CREATE TABLE b (id INT)"]
