import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "api"
if str(API) not in sys.path:
    sys.path.insert(0, str(API))
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
