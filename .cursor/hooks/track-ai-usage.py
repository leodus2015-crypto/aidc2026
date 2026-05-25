#!/usr/bin/env python3
"""Accumulate estimated AI token usage for the AIDC project via Cursor hooks."""

from __future__ import annotations

import fcntl
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

CHARS_PER_TOKEN = 2.5
PROJECT_MARKERS = ("aidc", "cursorProject/aidc", "cursor project/aidc")
TZ_CN = timezone(timedelta(hours=8))


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def usage_path() -> Path:
    return project_root() / "data" / "ai-usage.json"


def is_aidc_workspace(workspace_roots: list[str] | None) -> bool:
    if not workspace_roots:
        return False
    normalized = [root.replace("\\", "/").lower() for root in workspace_roots]
    return any(any(marker in root for marker in PROJECT_MARKERS) for root in normalized)


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, int(len(text) / CHARS_PER_TOKEN))


def load_usage() -> dict:
    path = usage_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        return {
            "version": 1,
            "updated_at": now_iso(),
            "baseline": {"total_tokens": 0, "categories": []},
            "tracked": {
                "method": "cursor-hooks-estimate",
                "since": datetime.now(TZ_CN).date().isoformat(),
                "total_tokens": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "thinking_tokens": 0,
                "sessions": 0,
                "events": 0,
                "by_model": {},
            },
            "notes": "tracked 为 Hook 估算增量，非官方账单。",
        }
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_usage(data: dict) -> None:
    path = usage_path()
    data["updated_at"] = now_iso()
    tmp_path = path.with_suffix(".json.tmp")
    with tmp_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    tmp_path.replace(path)


def now_iso() -> str:
    return datetime.now(TZ_CN).replace(microsecond=0).isoformat()


def bump_model(tracked: dict, model: str, tokens: int) -> None:
    if not model or tokens <= 0:
        return
    by_model = tracked.setdefault("by_model", {})
    by_model[model] = int(by_model.get(model, 0)) + tokens


def add_tokens(tracked: dict, model: str, kind: str, tokens: int) -> None:
    if tokens <= 0:
        return
    tracked[kind] = int(tracked.get(kind, 0)) + tokens
    tracked["total_tokens"] = int(tracked.get("total_tokens", 0)) + tokens
    tracked["events"] = int(tracked.get("events", 0)) + 1
    bump_model(tracked, model, tokens)


def process_event(payload: dict) -> None:
    if not is_aidc_workspace(payload.get("workspace_roots")):
        return

    event = payload.get("hook_event_name", "")
    model = payload.get("model") or "unknown"
    data = load_usage()
    tracked = data.setdefault(
        "tracked",
        {
            "method": "cursor-hooks-estimate",
            "since": datetime.now(TZ_CN).date().isoformat(),
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "thinking_tokens": 0,
            "sessions": 0,
            "events": 0,
            "by_model": {},
        },
    )

    if event == "beforeSubmitPrompt":
        prompt = payload.get("prompt") or ""
        tokens = estimate_tokens(prompt)
        for attachment in payload.get("attachments") or []:
            file_path = attachment.get("file_path")
            if not file_path:
                continue
            try:
                tokens += estimate_tokens(Path(file_path).read_text(encoding="utf-8", errors="ignore")[:20000])
            except OSError:
                pass
        add_tokens(tracked, model, "input_tokens", tokens)
    elif event == "afterAgentResponse":
        add_tokens(tracked, model, "output_tokens", estimate_tokens(payload.get("text") or ""))
    elif event == "afterAgentThought":
        add_tokens(tracked, model, "thinking_tokens", estimate_tokens(payload.get("text") or ""))
    elif event == "sessionEnd":
        tracked["sessions"] = int(tracked.get("sessions", 0)) + 1
        tracked["events"] = int(tracked.get("events", 0)) + 1
    else:
        return

    save_usage(data)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    lock_path = usage_path().with_suffix(".json.lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("w", encoding="utf-8") as lock_handle:
        fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX)
        process_event(payload)
        fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
