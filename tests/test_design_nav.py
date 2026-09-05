import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_design_tabs_match_registry_and_markup():
    js = (ROOT / "js" / "ai-dc-design-page.js").read_text(encoding="utf-8")
    html = (ROOT / "ai-dc-design.html").read_text(encoding="utf-8")
    registry = json.loads((ROOT / "data" / "page-registry.json").read_text(encoding="utf-8"))

    tabs = re.search(r"VALID_TABS = \[([^\]]+)\]", js)
    assert tabs, "VALID_TABS missing"
    valid_tabs = re.findall(r"'([^']+)'", tabs.group(1))

    iframe_keys = re.findall(r"^\s{4}(\w+): '([^']+\.html)", js, flags=re.M)
    iframe_by_key = dict(iframe_keys)

    html_tabs = re.findall(r'data-layout-tab="([^"]+)"', html)
    html_iframes = re.findall(r'data-iframe-key="([^"]+)"', html)

    assert valid_tabs == html_tabs
    assert list(iframe_by_key) == html_iframes

    design = next(page for page in registry["pages"] if page["path"] == "ai-dc-design.html")
    embedded = set(design["embeds"])
    iframe_files = {src.split("?")[0] for src in iframe_by_key.values()}
    assert iframe_files <= embedded
    assert {"ai-dc-tcp.html", "ai-dc-computeEst.html", "ai-dc-layout.html"} <= iframe_files

    child_tabs = {
        page["path"]: page["parents"][0]["tab"]
        for page in registry["pages"]
        if page.get("parents") and page["parents"][0].get("path") == "ai-dc-design.html"
    }
    assert set(child_tabs.values()) == set(valid_tabs)
