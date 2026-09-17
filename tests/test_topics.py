import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPICS_PATH = ROOT / "data" / "topics.json"
ALLOWED_KINDS = {"pdf", "html"}
ALLOWED_STATUS = {"published", "coming"}


def test_topics_catalog_is_valid():
    data = json.loads(TOPICS_PATH.read_text(encoding="utf-8"))
    assert data.get("version") == 1
    topics = data.get("topics")
    assert isinstance(topics, list) and topics

    ids = []
    for topic in topics:
        assert isinstance(topic, dict)
        topic_id = topic.get("id")
        assert isinstance(topic_id, str) and topic_id
        ids.append(topic_id)
        assert topic.get("kind") in ALLOWED_KINDS
        assert topic.get("status") in ALLOWED_STATUS
        href = topic.get("href")
        if topic["status"] == "published":
            assert isinstance(href, str) and href.endswith(".html")
            assert (ROOT / href).is_file(), f"published topic missing page: {href}"
        else:
            assert href in (None, "")
        year = topic.get("year")
        if year is not None:
            assert isinstance(year, str) and year.isdigit()
        locales = topic.get("locales")
        if locales is not None:
            assert isinstance(locales, list) and locales
            assert all(item in {"zh", "en"} for item in locales)

    assert len(ids) == len(set(ids))
    assert ids[0] == "whitepaper-2026"
    assert "whitepaper-2024" in ids
    assert "whitepaper-2026" in ids
    assert "sovereign-ai" in ids
    wp2024 = next(item for item in topics if item["id"] == "whitepaper-2024")
    assert wp2024.get("locales") == ["zh"]
    js = (ROOT / "js" / "topic-page.js").read_text(encoding="utf-8")
    assert "isVisibleForLocale" in js


def test_whitepaper_2026_page_and_pdfs():
    page = ROOT / "white-paper-2026.html"
    js = (ROOT / "js" / "white-paper-2026-page.js").read_text(encoding="utf-8")
    topics = json.loads(TOPICS_PATH.read_text(encoding="utf-8"))
    entry = next(item for item in topics["topics"] if item["id"] == "whitepaper-2026")
    assert page.is_file()
    assert entry["status"] == "published"
    assert entry["href"] == "white-paper-2026.html"
    assert "topic/ai-dc-white-paper-2026-cn.pdf" in js
    assert "topic/ai-dc-white-paper-2026-en.pdf" in js
    html = page.read_text(encoding="utf-8")
    assert 'data-i18n-page="white-paper-2026"' in html
    assert "topic/ai-dc-white-paper-2026-cn.pdf" in html
    assert "topic/ai-dc-white-paper-2026-en.pdf" in html
    zh = json.loads((ROOT / "i18n" / "white-paper-2026.zh.json").read_text(encoding="utf-8"))
    en = json.loads((ROOT / "i18n" / "white-paper-2026.en.json").read_text(encoding="utf-8"))
    assert "Agent" in zh["page"]["intro1"] and "WaTt" in zh["page"]["intro1"]
    assert "Agent" in en["page"]["intro1"] and "WaTt" in en["page"]["intro1"]
    topic_zh = json.loads((ROOT / "i18n" / "topic.zh.json").read_text(encoding="utf-8"))
    assert topic_zh["topics"]["whitepaper-2026"]["summary"] == zh["page"]["intro1"]


def test_live_html_links_topic_hub_not_retired_white_paper():
    leftover = []
    for path in ROOT.rglob("*.html"):
        if any(part.startswith(".") for part in path.relative_to(ROOT).parts):
            continue
        text = path.read_text(encoding="utf-8")
        if 'href="white-paper.html"' in text or "href='white-paper.html'" in text:
            leftover.append(path.relative_to(ROOT).as_posix())
    assert leftover == []
    nav = (ROOT / "ai-dc-design.html").read_text(encoding="utf-8")
    assert 'href="topic.html"' in nav


def test_sovereign_ai_deck_files_and_images_exist():
    wrapper = (ROOT / "js" / "topic-sovereign-ai-page.js").read_text(encoding="utf-8")
    assert "topic/sovereign-ai/sovereign-ai-zh.html" in wrapper
    assert "topic/sovereign-ai/sovereign-ai.html" in wrapper
    assert (ROOT / "topic/sovereign-ai/sovereign-ai-zh.html").is_file()
    assert (ROOT / "topic/sovereign-ai/sovereign-ai.html").is_file()
    for name in (
        "ai-history-icons-signal.png",
        "ai-national-action-signal.png",
        "ai-model-black-hole-signal.png",
        "ai-sovereign-factory-signal.png",
        "ai-full-stack-signal.png",
    ):
        assert (ROOT / "topic/sovereign-ai/assets" / name).is_file()
    page = (ROOT / "topic-sovereign-ai.html").read_text(encoding="utf-8")
    assert "演讲稿" not in page
    assert "speaker-script" not in page
    assert 'id="sovereign-present"' in page
    assert 'topic-deck-toolbar' in page
    assert 'topic-deck-present' in page
    assert 'id="sovereign-present-cta"' not in page
    assert 'id="sovereign-deck-stage"' in page
    assert "allowfullscreen" in page
    js = wrapper
    assert "requestFullscreen" in js
    assert "is-presenting" in js
    zh = json.loads((ROOT / "i18n" / "topic-sovereign-ai.zh.json").read_text(encoding="utf-8"))
    en = json.loads((ROOT / "i18n" / "topic-sovereign-ai.en.json").read_text(encoding="utf-8"))
    assert zh["page"]["present"]
    assert en["page"]["present"]
    assert zh["page"]["exitPresent"]
    assert en["page"]["exitPresent"]
