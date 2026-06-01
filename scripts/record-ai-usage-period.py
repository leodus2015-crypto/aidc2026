#!/usr/bin/env python3
"""Upsert a manual Included Usage period into data/ai-usage.json (replace on duplicate range)."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

TZ_CN = timezone(timedelta(hours=8))
ROOT = Path(__file__).resolve().parents[1]
USAGE_PATH = ROOT / "data" / "ai-usage.json"


def now_iso() -> str:
    return datetime.now(TZ_CN).replace(microsecond=0).isoformat()


def period_key(entry: dict) -> tuple[str, str]:
    return (entry.get("period_start", ""), entry.get("period_end", ""))


def load_usage() -> dict:
    if not USAGE_PATH.exists():
        return {
            "version": 2,
            "updated_at": now_iso(),
            "source": "Cursor Dashboard · Included Usage",
            "notes": "各周期均为控制台手工录入；同一周期重复录入时以最新值替换，不累加。",
            "periods": [],
        }
    with USAGE_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if "periods" not in data:
        data = migrate_v1(data)
    return data


def migrate_v1(data: dict) -> dict:
    periods = []
    baseline = data.get("baseline")
    if baseline and baseline.get("period_start") or baseline.get("period"):
        periods.append(
            {
                "period": baseline.get("period"),
                "period_start": baseline.get("period_start") or baseline.get("period", "").split("—")[0].strip(),
                "period_end": baseline.get("period_end") or baseline.get("period", "").split("—")[-1].strip(),
                "recorded_at": baseline.get("recorded_at"),
                "total_tokens": baseline.get("total_tokens", 0),
                "categories": baseline.get("categories", []),
            }
        )
    return {
        "version": 2,
        "updated_at": data.get("updated_at") or now_iso(),
        "source": baseline.get("source") if baseline else "Cursor Dashboard · Included Usage",
        "notes": "各周期均为控制台手工录入；同一周期重复录入时以最新值替换，不累加。",
        "periods": periods,
    }


def upsert_period(data: dict, entry: dict) -> None:
    key = period_key(entry)
    periods = [p for p in data.get("periods", []) if period_key(p) != key]
    periods.append(entry)
    periods.sort(key=lambda p: (p.get("period_start", ""), p.get("period_end", "")))
    data["periods"] = periods
    data["version"] = 2
    data["updated_at"] = now_iso()


def save_usage(data: dict) -> None:
    USAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = USAGE_PATH.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    tmp.replace(USAGE_PATH)


def main() -> int:
    parser = argparse.ArgumentParser(description="Record or replace one Included Usage billing period.")
    parser.add_argument("--json", help="Path to a period JSON object, or '-' for stdin")
    args = parser.parse_args()

    if not args.json:
        print("Provide --json path or '-' for stdin", file=sys.stderr)
        return 1

    raw = sys.stdin.read() if args.json == "-" else Path(args.json).read_text(encoding="utf-8")
    entry = json.loads(raw)
    if "period_start" not in entry or "period_end" not in entry:
        print("period_start and period_end are required", file=sys.stderr)
        return 1
    if "period" not in entry:
        entry["period"] = f"{entry['period_start']} — {entry['period_end']}"
    if "recorded_at" not in entry:
        entry["recorded_at"] = datetime.now(TZ_CN).date().isoformat()

    data = load_usage()
    upsert_period(data, entry)
    save_usage(data)
    print(f"Saved {entry['period']} · {entry.get('total_tokens', 0)} tokens")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
