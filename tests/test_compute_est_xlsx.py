"""Compute-est Excel export formulas stay aligned with the page model."""

from __future__ import annotations

import math
import re
from pathlib import Path

from formulas import compute_cards, daily_tokens, min_hbm_cards, planned_cards

ROOT = Path(__file__).resolve().parent.parent
XLSX_JS = (ROOT / "js" / "aidc-compute-est-xlsx.js").read_text(encoding="utf-8")
PAGE_HTML = (ROOT / "ai-dc-computeEst.html").read_text(encoding="utf-8")
DESIGN_JS = (ROOT / "js" / "ai-dc-design-page.js").read_text(encoding="utf-8")

FORMULA_BLOCK_RE = re.compile(r"const MODEL_FORMULAS = \{([\s\S]*?)\n  \};")
SAFE_EXPR_RE = re.compile(r"^[A-Za-z0-9_+\-*/><(),.\sE]+$")


def parse_model_formulas() -> dict[str, str]:
    match = FORMULA_BLOCK_RE.search(XLSX_JS)
    assert match, "MODEL_FORMULAS missing from aidc-compute-est-xlsx.js"
    return {
        raw_key: raw_formula
        for raw_key, raw_formula in re.findall(r"([A-Za-z][A-Za-z0-9]*):\s*'([^']+)'", match.group(1))
    }


def excel_ceiling(value: float, significance: float = 1.0) -> float:
    if significance == 0:
        return math.nan
    return math.ceil(value / significance) * significance


def eval_excel(expr: str, env: dict[str, float]) -> float:
    assert SAFE_EXPR_RE.match(expr), expr

    def CEILING(value, digits=1):
        return excel_ceiling(float(value), float(digits))

    def MAX(*values):
        return max(float(v) for v in values)

    def POWER(base, exp):
        return float(base) ** float(exp)

    def IF(cond, left, right):
        return left if cond else right

    return eval(expr, {"__builtins__": {}}, {**env, "CEILING": CEILING, "MAX": MAX, "POWER": POWER, "IF": IF})


def test_html_download_button_hidden_until_unlock():
    assert 'id="downloadXlsxBtn"' in PAGE_HTML
    assert "hidden" in PAGE_HTML.split('id="downloadXlsxBtn"', 1)[1][:80]
    assert "js/aidc-compute-est-xlsx.js" in PAGE_HTML
    assert "AidcComputeEstXlsx.download" in PAGE_HTML
    assert "AidcConfig.verifyAdmin" in PAGE_HTML
    assert "computeEst: 'ai-dc-computeEst.html?embed=1&rev=xlsx-2'" in DESIGN_JS
    assert 'id="exportCard"' in PAGE_HTML


def test_workbook_visible_text_follows_page_locale():
    assert "function sheetNames(payload)" in XLSX_JS
    assert "AIDC-算力估算.xlsx" in XLSX_JS
    assert "AIDC-Compute-Est.xlsx" in XLSX_JS
    assert "t(payload, field.labelKey)" in XLSX_JS
    assert "cellStr(ref(1, row), field.id)" not in XLSX_JS
    assert 'sheet name="Inputs"' not in XLSX_JS
    assert "xml(names.inputs)" in XLSX_JS
    assert "xlsx_sheet_inputs" in PAGE_HTML
    assert '"en": "Inputs"' in PAGE_HTML
    assert '"en": "Model"' in PAGE_HTML
    assert '"en": "Years"' in PAGE_HTML


def test_workbook_xml_order_is_excel_safe():
    workbook_fn = re.search(r"function workbookXml\(nameMap, sheets\) \{([\s\S]*?)\n  \}", XLSX_JS)
    sheet_fn = re.search(r"function sheetXml\(rows, colWidths, freezeRow\) \{([\s\S]*?)\n  \}", XLSX_JS)
    assert workbook_fn and sheet_fn
    workbook = workbook_fn.group(1)
    sheet = sheet_fn.group(1)
    assert workbook.find("<sheets>") < workbook.find("<calcPr")
    assert sheet.find("<dimension") < sheet.find("sheetData")


def test_excel_formulas_match_coding_preset():
    formulas = parse_model_formulas()
    env = {
        "inTokens": 9_900_000.0,
        "outTokens": 100_000.0,
        "cacheHitRate": 0.0,
        "dau": 12700.0,
        "currentPenetration": 100.0,
        "futurePenetration": 100.0,
        "activeParams": 40.0,
        "totalParams": 744.0,
        "flopsMultiplier": 2.0,
        "peakMultiplier": 3.0,
        "utilization": 45.0,
        "computeMargin": 1.2,
        "years": 5.0,
        "frequencyFactor": 3.0,
        "agentFactor": 4.0,
        "cardTflops": 919.0,
        "cardsPerDevice": 8.0,
        "cardVram": 96.0,
        "weightPrecision": 1.0,
        "vramUsable": 80.0,
    }
    for name, formula in formulas.items():
        env[name] = eval_excel(formula, env)

    tokens = daily_tokens(12700, 100, 9_900_000, 100_000, 0)
    assert env["dailyTokensRaw"] == tokens
    assert env["computeCards"] == compute_cards(
        token_per_sec=tokens / 86400,
        flops_multiplier=2,
        active_params_b=40,
        peak_multiplier=3,
        utilization_pct=45,
        compute_margin=1.2,
        card_tflops=919,
    )
    assert env["minCards"] == min_hbm_cards(744, 1, 96, 80)
    assert env["currentCards"] == planned_cards(int(env["computeCards"]), int(env["minCards"]))
    assert env["growthMultiple"] == 12
    assert env["futureCards"] == planned_cards(
        int(excel_ceiling(env["futurePflops"] * 1e15 / env["cardFlops"])),
        int(env["minCards"]),
    )
