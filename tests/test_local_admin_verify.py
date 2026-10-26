"""Local 8011 unlock falls back to .env ADMIN_TOKEN; production still uses /api/admin/verify."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


def _load_writer():
    path = Path(__file__).resolve().parent.parent / "scripts" / "write-local-dev-admin.py"
    spec = importlib.util.spec_from_file_location("write_local_dev_admin", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


_writer = _load_writer()
write_local_dev_admin = _writer.write_local_dev_admin

ROOT = Path(__file__).resolve().parent.parent
CONFIG_JS = (ROOT / "js" / "config-loader.js").read_text(encoding="utf-8")
API_JS = (ROOT / "js" / "aidc-api-client.js").read_text(encoding="utf-8")
DEPLOY_SH = (ROOT / "scripts" / "deploy.sh").read_text(encoding="utf-8")
DEPLOY_YML = (ROOT / ".github" / "workflows" / "deploy.yml").read_text(encoding="utf-8")


def test_local_admin_file_is_gitignored_and_not_deployed():
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "data/local-dev-admin.json" in gitignore
    assert "data/local-dev-admin.json" in DEPLOY_SH
    assert "data/local-dev-admin.json" in DEPLOY_YML


def test_write_local_dev_admin_roundtrip(tmp_path):
    dest = tmp_path / "local-dev-admin.json"
    assert write_local_dev_admin("Secret-Token", dest) == dest
    assert json.loads(dest.read_text(encoding="utf-8")) == {"token": "Secret-Token"}
    assert write_local_dev_admin("", dest) is None
    assert not dest.exists()


def test_frontend_verify_tries_api_first_and_gates_local_fallback():
    assert "function verifyAdmin(token, options)" in CONFIG_JS
    verify_fn = CONFIG_JS.split("async function verifyAdmin(token, options)", 1)[1]
    assert verify_fn.find("api().verifyAdmin") < verify_fn.find("isLocalPreviewHost")
    assert "if (!isLocalPreviewHost()) throw error" in CONFIG_JS
    assert "data/local-dev-admin.json" in CONFIG_JS
    assert "aidc2026" not in CONFIG_JS
    assert "site.unlock_password" not in CONFIG_JS
    assert "location.port === '8011'" in API_JS
    assert "return 'http://127.0.0.1:8012'" in API_JS


def test_committed_frontend_has_no_hardcoded_admin_token():
    env_path = ROOT / ".env"
    token = ""
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("ADMIN_TOKEN="):
                token = line.split("=", 1)[1].strip().strip("'").strip('"')
                break
    if token and len(token) >= 6:
        assert token not in CONFIG_JS
        assert token not in API_JS
        assert token not in (ROOT / "js" / "aidc-investment-roi-page.js").read_text(encoding="utf-8")
