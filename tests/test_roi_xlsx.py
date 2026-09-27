"""ROI Excel export formulas stay aligned with the page model."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

from formulas import roi_state

ROOT = Path(__file__).resolve().parent.parent
XLSX_JS = (ROOT / "js" / "aidc-investment-roi-xlsx.js").read_text(encoding="utf-8")
PAGE_JS = (ROOT / "js" / "aidc-investment-roi-page.js").read_text(encoding="utf-8")
PAGE_HTML = (ROOT / "aidc-investment-roi.html").read_text(encoding="utf-8")
DEFAULTS = json.loads((ROOT / "data" / "config-seeds" / "roi.defaults.json").read_text(encoding="utf-8"))
CLOUD = json.loads((ROOT / "data" / "config-seeds" / "roi.cloud_compare.json").read_text(encoding="utf-8"))

FORMULA_BLOCK_RE = re.compile(r"const MODEL_FORMULAS = \{([\s\S]*?)\n  \};")
FIELD_ID_RE = re.compile(r"\{ id: '([A-Za-z][A-Za-z0-9]*)'")
SAFE_EXPR_RE = re.compile(r"^[A-Za-z0-9_+\-*/><(),.\s]+$")


def parse_model_formulas() -> dict[str, str]:
    match = FORMULA_BLOCK_RE.search(XLSX_JS)
    assert match, "MODEL_FORMULAS missing from aidc-investment-roi-xlsx.js"
    formulas = {}
    for raw_key, raw_formula in re.findall(r"([A-Za-z][A-Za-z0-9]*):\s*'([^']+)'", match.group(1)):
        formulas[raw_key] = raw_formula
    return formulas


def parse_input_ids() -> list[str]:
    block = re.search(r"const INPUT_FIELDS = \[([\s\S]*?)\n  \];", XLSX_JS)
    assert block, "INPUT_FIELDS missing"
    return FIELD_ID_RE.findall(block.group(1))


def excel_round(value: float, digits: int) -> float:
    factor = 10 ** digits
    if value >= 0:
        return math.floor(value * factor + 0.5) / factor
    return math.ceil(value * factor - 0.5) / factor


def eval_excel(expr: str, env: dict[str, float]) -> float:
    assert SAFE_EXPR_RE.match(expr), expr

    def ROUND(value, digits):
        return excel_round(float(value), int(digits))

    def IF(cond, left, right):
        return left if cond else right

    def NA():
        return math.nan

    return eval(expr, {"__builtins__": {}}, {**env, "ROUND": ROUND, "IF": IF, "NA": NA})


def test_html_download_button_hidden_until_unlock():
    assert 'id="downloadXlsxBtn"' in PAGE_HTML
    assert 'class="hidden' in PAGE_HTML.split('id="downloadXlsxBtn"', 1)[1][:200]
    assert "js/aidc-investment-roi-xlsx.js" in PAGE_HTML
    assert "downloadBtn.classList.toggle('hidden', !visible)" in PAGE_JS
    assert "AidcInvestmentRoiXlsx.download" in PAGE_JS


def test_input_fields_cover_page_collect_keys():
    ids = set(parse_input_ids())
    required = {
        "computeP",
        "clusterMw",
        "pctItDevice",
        "pctPowerCool",
        "pctLandBuild",
        "npuUnitPrice",
        "ascendInItPct",
        "deprecYears",
        "pue",
        "elecPrice",
        "utilization",
        "tpsInputMiss",
        "tpsInputHit",
        "tpsOutput",
        "pctMixMiss",
        "pctMixHit",
        "pctMixOut",
        "annualFixedOpex",
        "capexOpexPct",
        "serviceModel",
        "refInputMiss",
        "refInputHit",
        "refOutput",
    }
    assert required <= ids


def test_excel_formulas_match_page_defaults():
    formulas = parse_model_formulas()
    refs = {
        "refInputMiss": CLOUD["ds-v4"]["refInputMiss"],
        "refInputHit": CLOUD["ds-v4"]["refInputHit"],
        "refOutput": CLOUD["ds-v4"]["refOutput"],
    }
    expected = roi_state(DEFAULTS, refs)
    env = {key: float(value) for key, value in DEFAULTS.items() if key not in {"schemaVersion", "serviceModel"}}
    env.update(refs)
    for name, formula in formulas.items():
        env[name] = eval_excel(formula, env)

    for key, value in expected.items():
        if key not in formulas:
            continue
        if math.isnan(value):
            assert math.isnan(env[key]), key
        else:
            assert env[key] == value or abs(env[key] - value) < 1e-6, f"{key}: {env[key]} != {value}"


def test_core_formulas_use_page_constants():
    formulas = parse_model_formulas()
    assert formulas["ascendCost"] == "npuCount*npuUnitPrice*10000"
    assert formulas["itEquipment"] == "IF(ascendPct>0,ascendCost/ascendPct,NA())"
    assert formulas["totalCapex"] == "IF(itPct>0,itEquipment/itPct,NA())"
    assert formulas["annualPower"] == "clusterMw*1000*8760*pue*util*elecPrice"
    assert formulas["annualMissTokens"] == "npuCount*tpsInputMiss*86400*365*util"
    assert formulas["costPerMOut"] == "IF(outputTokensM>0,annualCost*mixOut/outputTokensM,NA())"
    assert formulas["annualCost"] == "annualDep+annualPower+annualOps"
