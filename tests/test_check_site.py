import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_check_site_passes():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check-site.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout


def load_check_site_module():
    path = ROOT / "scripts" / "check-site.py"
    spec = importlib.util.spec_from_file_location("aidc_check_site", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_page_registry_reports_duplicate_id_unregistered_and_asymmetric_relation(tmp_path):
    check_site = load_check_site_module()
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (tmp_path / "parent.html").write_text(
        '<body data-i18n-page="same"></body>',
        encoding="utf-8",
    )
    (tmp_path / "child.html").write_text(
        '<body data-i18n-page="same"></body>',
        encoding="utf-8",
    )
    (tmp_path / "orphan.html").write_text(
        '<body data-i18n-page="orphan"></body>',
        encoding="utf-8",
    )
    registry = {
        "schemaVersion": 1,
        "pages": [
            {
                "path": "parent.html",
                "id": "same",
                "kind": "container",
                "visibility": "public",
                "parents": [],
                "embeds": ["child.html"],
                "assets": [],
                "dataSources": [],
            },
            {
                "path": "child.html",
                "id": "same",
                "kind": "embedded",
                "visibility": "public",
                "parents": [],
                "embeds": [],
                "assets": [],
                "dataSources": [],
            },
        ],
    }
    registry_path = data_dir / "page-registry.json"
    errors = []

    check_site.check_page_registry(errors, {registry_path: registry}, root=tmp_path)

    assert any("id 重复" in error for error in errors)
    assert any("HTML 未登记" in error and "orphan.html" in error for error in errors)
    assert any("页面关系不对称" in error for error in errors)
