import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATABASE_HOST = os.getenv("DATABASE_HOST", "").strip()
DATABASE_PORT = int(os.getenv("DATABASE_PORT", "3306"))
DATABASE_USER = os.getenv("DATABASE_USER", "").strip()
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "")
DATABASE_NAME = os.getenv("DATABASE_NAME", "aidc").strip()

# No insecure default: write/analytics endpoints refuse when unset.
ADMIN_TOKEN = (os.getenv("ADMIN_TOKEN") or "").strip()
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8012"))
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:8011,http://localhost:8011",
    ).split(",")
    if o.strip()
]

ALLOWED_CONFIG_KEYS = frozenset(
    {
        "roi.defaults",
        "roi.defaults.en",
        "roi.cloud_compare",
        "roi.cloud_compare.en",
        "dc3d.case_a",
        "dc3d.case_b",
        "site.unlock_password",
    }
)


def database_configured() -> bool:
    return bool(DATABASE_HOST and DATABASE_USER and DATABASE_NAME)
