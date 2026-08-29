#!/usr/bin/env python3
"""Merge Cursor usage-events CSV into data/ai-usage.json (incremental by date).

For each billing period already in ai-usage.json, only rows with event date
strictly after that period's recorded_at are added to totals and token types.
New billing periods are appended from the CSV in full.

Token type rules (see data/ai-usage.json notes):
  input_cache_hit  = Cache Read
  input_cache_miss = Input (w/ Cache Write) + Input (w/o Cache Write)
  output           = Output Tokens

Legacy periods that only have Cache / API / Auto+Composer categories are
converted with proportional split (not exact).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

TZ_CN = timezone(timedelta(hours=8))
ROOT = Path(__file__).resolve().parents[1]
USAGE_PATH = ROOT / "data/ai-usage.json"

SKIP_DIRS = {".git"}
CODE_EXT = {".html": "HTML", ".js": "JavaScript", ".sh": "Shell", ".svg": "SVG"}
EXCLUDE_EXT = {".pdf"}

TOKEN_TYPE_ORDER = ("input_cache_miss", "input_cache_hit", "output")
USAGE_NOTES = (
    "由 Cursor 导出 CSV 汇总；Included 行按账单周期拆分。"
    "同一周期重复导入时，仅合并事件日期晚于 recorded_at 的增量。"
    "input_cache_hit = Cache Read；"
    "input_cache_miss = Input (w/ Cache Write) + Input (w/o Cache Write)；"
    "output = Output Tokens。"
    "历史仅有模型侧分类的周期，按近期实测比例估算三类拆分。"
)

# Fallback ratios among Input(w/o Cache Write) + Output, from recent CSV sample.
DEFAULT_INPUT_WO_SHARE = 0.8681
DEFAULT_OUTPUT_SHARE = 0.1319


def now_iso() -> str:
    return datetime.now(TZ_CN).replace(microsecond=0).isoformat()


def period_bounds(d: date) -> tuple[str, str] | None:
    if date(2026, 4, 25) <= d < date(2026, 5, 25):
        return ("2026-04-25", "2026-05-25")
    if date(2026, 5, 25) <= d < date(2026, 6, 25):
        return ("2026-05-25", "2026-06-25")
    if date(2026, 6, 25) <= d < date(2026, 7, 25):
        return ("2026-06-25", "2026-07-25")
    if date(2026, 7, 25) <= d < date(2026, 8, 25):
        return ("2026-07-25", "2026-08-25")
    if date(2026, 8, 25) <= d < date(2026, 9, 25):
        return ("2026-08-25", "2026-09-25")
    return None


def parse_csv(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row.get("Kind") != "Included":
                continue
            total_raw = (row.get("Total Tokens") or "").strip().replace(",", "")
            if not total_raw.isdigit():
                continue
            dt = datetime.fromisoformat(row["Date"].replace("Z", "+00:00"))
            bounds = period_bounds(dt.date())
            if not bounds:
                continue
            rows.append(
                {
                    "date": dt.date(),
                    "period_start": bounds[0],
                    "period_end": bounds[1],
                    "cache_write": int(row.get("Input (w/ Cache Write)", "0") or 0),
                    "input": int(row.get("Input (w/o Cache Write)", "0") or 0),
                    "cache_read": int(row.get("Cache Read", "0") or 0),
                    "output": int(row.get("Output Tokens", "0") or 0),
                    "total": int(total_raw),
                }
            )
    return rows


def pct(part: int, total: int) -> float:
    return round(part * 100 / total, 1) if total else 0.0


def build_token_types(miss: int, hit: int, output: int) -> list[dict]:
    total = miss + hit + output
    return [
        {"name": "input_cache_miss", "tokens": miss, "usage_percent": pct(miss, total)},
        {"name": "input_cache_hit", "tokens": hit, "usage_percent": pct(hit, total)},
        {"name": "output", "tokens": output, "usage_percent": pct(output, total)},
    ]


def aggregate_rows(rows: list[dict]) -> dict:
    miss = hit = output = 0
    for row in rows:
        miss += row["cache_write"] + row["input"]
        hit += row["cache_read"]
        output += row["output"]
    total = miss + hit + output
    return {
        "total_tokens": total,
        "token_types": build_token_types(miss, hit, output),
        "estimated": False,
    }


def merge_token_types(existing: list[dict], delta: list[dict]) -> list[dict]:
    totals = {name: 0 for name in TOKEN_TYPE_ORDER}
    for group in (existing, delta):
        for item in group or []:
            name = item.get("name")
            if name in totals:
                totals[name] += int(item.get("tokens") or 0)
    return build_token_types(
        totals["input_cache_miss"],
        totals["input_cache_hit"],
        totals["output"],
    )


def token_type_map(token_types: list[dict] | None) -> dict[str, int]:
    out = {name: 0 for name in TOKEN_TYPE_ORDER}
    for item in token_types or []:
        name = item.get("name")
        if name in out:
            out[name] = int(item.get("tokens") or 0)
    return out


def shares_from_rows(rows: list[dict]) -> tuple[float, float]:
    """Among Input(w/o Cache Write)+Output, return (input_wo_share, output_share)."""
    input_wo = output = 0
    for row in rows:
        input_wo += row["input"]
        output += row["output"]
    denom = input_wo + output
    if denom <= 0:
        return DEFAULT_INPUT_WO_SHARE, DEFAULT_OUTPUT_SHARE
    return input_wo / denom, output / denom


def convert_legacy_categories(
    categories: list[dict],
    total_tokens: int,
    input_wo_share: float,
    output_share: float,
) -> tuple[list[dict], bool]:
    hit = write = other = 0
    for cat in categories or []:
        name = cat.get("name")
        tokens = int(cat.get("tokens") or 0)
        if name == "Cache":
            items = {item.get("name"): int(item.get("tokens") or 0) for item in cat.get("items") or []}
            if items:
                hit += items.get("Cache Read", 0)
                write += items.get("Cache Write", 0)
            else:
                hit += tokens
        else:
            other += tokens

    accounted = hit + write + other
    if accounted <= 0 and total_tokens > 0:
        hit_share = 0.95
        non_hit = total_tokens - int(round(total_tokens * hit_share))
        miss = int(round(non_hit * input_wo_share / (input_wo_share + output_share)))
        output = non_hit - miss
        hit = total_tokens - miss - output
        return build_token_types(miss, hit, output), True

    if accounted != total_tokens and total_tokens > 0:
        scale = total_tokens / accounted
        hit = int(round(hit * scale))
        write = int(round(write * scale))
        other = total_tokens - hit - write

    miss_from_other = int(round(other * input_wo_share))
    output = other - miss_from_other
    miss = write + miss_from_other
    current = miss + hit + output
    if current != total_tokens:
        hit += total_tokens - current
    return build_token_types(miss, hit, output), True


def ensure_token_types(
    data: dict,
    input_wo_share: float = DEFAULT_INPUT_WO_SHARE,
    output_share: float = DEFAULT_OUTPUT_SHARE,
) -> int:
    """Convert legacy category periods to token_types. Returns converted count."""
    converted = 0
    for period in data.get("periods", []):
        if period.get("token_types") and "categories" not in period:
            continue
        total = int(period.get("total_tokens") or 0)
        types, estimated = convert_legacy_categories(
            period.get("categories") or [],
            total,
            input_wo_share,
            output_share,
        )
        period["token_types"] = types
        period["estimated"] = estimated
        period.pop("categories", None)
        period["total_tokens"] = sum(int(x.get("tokens") or 0) for x in types)
        converted += 1
    data["notes"] = USAGE_NOTES
    data["version"] = 3
    return converted


def load_usage() -> dict:
    with USAGE_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_usage(data: dict) -> None:
    tmp = USAGE_PATH.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    tmp.replace(USAGE_PATH)


def merge_csv(csv_path: Path, recorded_at: date | None = None) -> dict:
    recorded_at = recorded_at or datetime.now(TZ_CN).date()
    rows = parse_csv(csv_path)
    data = load_usage()
    input_wo_share, output_share = shares_from_rows(rows)
    ensure_token_types(data, input_wo_share, output_share)
    periods_by_key = {(p["period_start"], p["period_end"]): p for p in data.get("periods", [])}

    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        key = (row["period_start"], row["period_end"])
        grouped[key].append(row)

    merged_delta_tokens = 0
    for key, period_rows in grouped.items():
        if key in periods_by_key:
            period = periods_by_key[key]
            cutoff = date.fromisoformat(period["recorded_at"])
            delta_rows = [r for r in period_rows if r["date"] > cutoff]
            if not delta_rows:
                continue
            delta = aggregate_rows(delta_rows)
            period["total_tokens"] = period.get("total_tokens", 0) + delta["total_tokens"]
            period["token_types"] = merge_token_types(period.get("token_types", []), delta["token_types"])
            period["recorded_at"] = max(r["date"] for r in delta_rows).isoformat()
            merged_delta_tokens += delta["total_tokens"]
        else:
            agg = aggregate_rows(period_rows)
            start, end = key
            periods_by_key[key] = {
                "period": f"{start} — {end}",
                "period_start": start,
                "period_end": end,
                "recorded_at": recorded_at.isoformat(),
                "total_tokens": agg["total_tokens"],
                "token_types": agg["token_types"],
                "estimated": False,
            }
            merged_delta_tokens += agg["total_tokens"]

    data["periods"] = sorted(periods_by_key.values(), key=lambda p: p["period_start"])
    data["updated_at"] = now_iso()
    data["source"] = f"Cursor Dashboard · {csv_path.name}"
    data["notes"] = USAGE_NOTES
    data["version"] = 3
    save_usage(data)
    return {"merged_delta_tokens": merged_delta_tokens, "periods": len(data["periods"])}


def count_code() -> dict:
    lines_by_lang: dict[str, int] = defaultdict(int)
    files_by_lang: dict[str, int] = defaultdict(int)
    total_lines = total_chars = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in EXCLUDE_EXT or ext not in CODE_EXT:
                continue
            text = (Path(dirpath) / fn).read_text(encoding="utf-8", errors="ignore")
            n_lines = text.count("\n") + (0 if text.endswith("\n") or not text else 1)
            lang = CODE_EXT[ext]
            lines_by_lang[lang] += n_lines
            files_by_lang[lang] += 1
            total_lines += n_lines
            total_chars += len(text)

    def lang_pct(n: int) -> str:
        return f"{n * 100 / total_lines:.1f}%" if total_lines else "0%"

    mid_tokens = int(total_chars / 2.5)
    low_tokens = int(total_chars / 3)
    high_tokens = int(total_chars / 2)

    return {
        "total_lines": total_lines,
        "total_files": sum(files_by_lang.values()),
        "total_chars": total_chars,
        "lines_by_lang": dict(lines_by_lang),
        "files_by_lang": dict(files_by_lang),
        "pct": {k: lang_pct(lines_by_lang[k]) for k in CODE_EXT.values()},
        "tokens_mid_k": mid_tokens // 1000,
        "tokens_low_k": low_tokens // 1000,
        "tokens_high_k": high_tokens // 1000,
    }


def update_code_volume_pages(code: dict) -> None:
    """Sync code volume stats into i18n JSON and about-us.html bar widths."""

    def fmt_lines(n: int) -> str:
        return f"{n:,}"

    html_lines = code["lines_by_lang"].get("HTML", 0)
    js_lines = code["lines_by_lang"].get("JavaScript", 0)
    shell_lines = code["lines_by_lang"].get("Shell", 0)
    svg_lines = code["lines_by_lang"].get("SVG", 0)
    html_files = code["files_by_lang"].get("HTML", 0)
    js_files = code["files_by_lang"].get("JavaScript", 0)
    shell_files = code["files_by_lang"].get("Shell", 0)

    zh_path = ROOT / "i18n" / "about-us.zh.json"
    en_path = ROOT / "i18n" / "about-us.en.json"
    for path, lang in ((zh_path, "zh"), (en_path, "en")):
        data = json.loads(path.read_text(encoding="utf-8"))
        cv = data["codeVolume"]
        cv["statLinesValue"] = (
            f"{fmt_lines(code['total_lines'])} 行" if lang == "zh" else f"{fmt_lines(code['total_lines'])} lines"
        )
        cv["statTokensValue"] = (
            f"{code['tokens_mid_k']}K Tokens" if lang == "zh" else f"{code['tokens_mid_k']}K tokens"
        )
        chars = code["total_chars"]
        cv["statLinesNote"] = (
            f"若将全部源码一次性作为 Prompt 输入；{chars:,} 字符 ÷ 2.5 字符/Token，区间约 {code['tokens_low_k']}K–{code['tokens_high_k']}K。"
            if lang == "zh"
            else f"If all source were fed as a single prompt: {chars:,} characters ÷ 2.5 chars/token, roughly {code['tokens_low_k']}K–{code['tokens_high_k']}K."
        )
        cv["statFilesValue"] = f"{code['total_files']} 个" if lang == "zh" else str(code["total_files"])
        cv["langHtmlShare"] = (
            f"{fmt_lines(html_lines)} 行 · {code['pct']['HTML']}"
            if lang == "zh"
            else f"{fmt_lines(html_lines)} lines · {code['pct']['HTML']}"
        )
        cv["langHtmlNote"] = (
            f"{html_files} 个页面文件（首页、推理原理、推理服务数据流、Agentic 推理、后训练、AI DC 规划、机房布局、3D 案例、ROI、About 等）"
            if lang == "zh"
            else f"{html_files} page files (home, inference basics, inference data flow, Agentic inference, post-training, AI DC design, room layout, 3D cases, ROI, About, etc.)"
        )
        cv["langJsShare"] = (
            f"{fmt_lines(js_lines)} 行 · {code['pct']['JavaScript']}"
            if lang == "zh"
            else f"{fmt_lines(js_lines)} lines · {code['pct']['JavaScript']}"
        )
        cv["langJsNote"] = (
            f"{js_files} 个脚本（i18n、各页逻辑、配置加载与语言桥接等）"
            if lang == "zh"
            else f"{js_files} scripts (i18n, page logic, config loader, locale bridge, etc.)"
        )
        cv["langSvgShare"] = (
            f"{fmt_lines(svg_lines)} 行 · {code['pct']['SVG']}"
            if lang == "zh"
            else f"{fmt_lines(svg_lines)} lines · {code['pct']['SVG']}"
        )
        cv["langShellShare"] = (
            f"{fmt_lines(shell_lines)} 行 · {code['pct']['Shell']}"
            if lang == "zh"
            else f"{fmt_lines(shell_lines)} lines · {code['pct']['Shell']}"
        )
        cv["langShellNote"] = (
            f"{shell_files} 个脚本（本地预览、部署、API 启动与校验等）"
            if lang == "zh"
            else f"{shell_files} scripts (local preview, deploy, API startup, verification, etc.)"
        )
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    html_path = ROOT / "about-us.html"
    html = html_path.read_text(encoding="utf-8")
    widths = {
        "bg-blue-600": code["pct"]["HTML"].rstrip("%"),
        "bg-amber-500": code["pct"]["JavaScript"].rstrip("%"),
        "bg-violet-500": code["pct"]["SVG"].rstrip("%"),
        "bg-emerald-500": code["pct"]["Shell"].rstrip("%"),
    }
    for color, width in widths.items():
        html = re.sub(
            rf'(class="h-full rounded-full {color}" style="width: )[\d.]+%',
            rf"\g<1>{width}%",
            html,
            count=1,
        )
    html_path.write_text(html, encoding="utf-8")


def sync_about_us_fallback() -> None:
    data = load_usage()
    js_path = ROOT / "js" / "about-us-page.js"
    text = js_path.read_text(encoding="utf-8")
    start = text.index("  const fallback = ")
    end = text.index("\n};", start) + 3
    js_path.write_text(text[:start] + "  const fallback = " + json.dumps(data, indent=4) + ";" + text[end:], encoding="utf-8")


def migrate_only(csv_path: Path | None = None) -> dict:
    data = load_usage()
    input_wo_share, output_share = DEFAULT_INPUT_WO_SHARE, DEFAULT_OUTPUT_SHARE
    if csv_path:
        input_wo_share, output_share = shares_from_rows(parse_csv(csv_path))
    converted = ensure_token_types(data, input_wo_share, output_share)
    data["updated_at"] = now_iso()
    data["notes"] = USAGE_NOTES
    data["version"] = 3
    if csv_path:
        data["source"] = f"Cursor Dashboard · {csv_path.name}"
    save_usage(data)
    return {
        "converted_periods": converted,
        "periods": len(data.get("periods", [])),
        "input_wo_share": round(input_wo_share, 4),
        "output_share": round(output_share, 4),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge usage-events CSV and refresh code stats JSON snippet.")
    parser.add_argument("csv", type=Path, nargs="?", help="Path to usage-events CSV export")
    parser.add_argument("--recorded-at", help="YYYY-MM-DD for recorded_at (default: today CN)")
    parser.add_argument("--code-only", action="store_true", help="Only recount code and update About US pages")
    parser.add_argument(
        "--migrate-types",
        action="store_true",
        help="Convert legacy model categories to input/output token types without importing CSV",
    )
    args = parser.parse_args()

    usage = None
    if args.code_only:
        if args.csv:
            parser.error("csv positional argument conflicts with --code-only")
    elif args.migrate_types:
        usage = migrate_only(args.csv)
        sync_about_us_fallback()
    elif args.csv:
        rec = date.fromisoformat(args.recorded_at) if args.recorded_at else None
        usage = merge_csv(args.csv, rec)
        sync_about_us_fallback()
    else:
        parser.error("csv path required unless --code-only or --migrate-types")

    code = count_code()
    update_code_volume_pages(code)
    print(json.dumps({"usage": usage, "code": code}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
