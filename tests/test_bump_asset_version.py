import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_bump_module():
    path = ROOT / "scripts" / "bump-asset-version.py"
    spec = importlib.util.spec_from_file_location("aidc_bump_asset_version", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_rewrite_preserves_extra_rev_query():
    bump = load_bump_module()
    html = """
  <script src="js/foo.js?v=88&rev=campus-row-3"></script>
  <link rel="stylesheet" href="css/bar.css?v=89&rev=cost-share-1" />
  <script src="js/plain.js?v=88"></script>
  <script src="js/nonesuch.js"></script>
"""
    out = bump.rewrite_local_asset_refs(html, "90")
    assert 'src="js/foo.js?v=90&rev=campus-row-3"' in out
    assert 'href="css/bar.css?v=90&rev=cost-share-1"' in out
    assert 'src="js/plain.js?v=90"' in out
    assert 'src="js/nonesuch.js?v=90"' in out
    assert "?v=88" not in out
    assert "?v=89" not in out
