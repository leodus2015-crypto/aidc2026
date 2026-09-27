from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_favicon_robots_sitemap_exist():
    assert (ROOT / "favicon.ico").is_file()
    assert (ROOT / "favicon.ico").stat().st_size > 64
    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    assert "User-agent: *" in robots
    assert "Allow: /" in robots
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert sitemap.strip().startswith("<?xml")
    assert 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' in sitemap
    locs = [
        "https://www.aidc2026.cn/ai-dc-design.html",
        "https://www.aidc2026.cn/index.html",
        "https://www.aidc2026.cn/post-training.html",
        "https://www.aidc2026.cn/topic.html",
        "https://www.aidc2026.cn/about-us.html",
        "https://www.aidc2026.cn/white-paper-2026.html",
        "https://www.aidc2026.cn/white-paper-2024.html",
        "https://www.aidc2026.cn/topic-sovereign-ai.html",
        "https://www.aidc2026.cn/topic-swarmtraces.html",
    ]
    assert sitemap.count("<loc>") == 9
    for loc in locs:
        assert loc in sitemap


def test_chrome_pages_have_noscript_and_icon():
    chrome = (
        "ai-dc-design.html",
        "index.html",
        "post-training.html",
        "topic.html",
        "about-us.html",
        "white-paper-2026.html",
        "white-paper-2024.html",
        "topic-swarmtraces.html",
        "404.html",
    )
    for rel in chrome:
        text = (ROOT / rel).read_text(encoding="utf-8")
        assert 'href="/favicon.ico"' in text
        assert "aidc-noscript" in text
        assert "<noscript>" in text


def test_nginx_http_root_redirects_to_https():
    text = (ROOT / "deploy/nginx-static-cache.conf").read_text(encoding="utf-8")
    assert 'if ($scheme != "https")' in text
    assert "return 301 https://$host$request_uri;" in text
    assert "return 301 https://$host/ai-dc-design.html;" in text
