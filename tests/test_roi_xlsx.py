"""ROI Excel export formulas stay aligned with the page model."""

from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
from pathlib import Path

import pytest

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


def test_workbook_xml_order_is_excel_safe():
    """Excel rejects OOXML when calcPr precedes sheets, or dimension follows sheetData."""
    workbook_fn = re.search(
        r"function workbookXml\(nameMap, sheets\) \{([\s\S]*?)\n  \}",
        XLSX_JS,
    )
    sheet_fn = re.search(
        r"function sheetXml\(rows, colWidths, freezeRow\) \{([\s\S]*?)\n  \}",
        XLSX_JS,
    )
    assert workbook_fn and sheet_fn
    workbook = workbook_fn.group(1)
    sheet = sheet_fn.group(1)
    assert workbook.find("<sheets>") < workbook.find("<calcPr")
    assert workbook.find("<bookViews>") < workbook.find("<sheets>")
    assert sheet.find("<dimension") < sheet.find("sheetData")
    assert sheet.find("sheetData") < sheet.find("</worksheet>")
    assert "dimension ref" in sheet
    assert "xml(names.inputs)" in workbook


def test_workbook_visible_text_follows_page_locale():
    """Sheet tabs and visible labels follow 中文 / en; field IDs stay off the grid."""
    assert "function sheetNames(payload)" in XLSX_JS
    assert "function quoteSheet(name)" in XLSX_JS
    assert "function sheetCell(sheetName, col, row)" in XLSX_JS
    assert "AIDC-Token收益.xlsx" in XLSX_JS
    assert "AIDC-Token-ROI.xlsx" in XLSX_JS
    assert "t(payload, field.unit)" in XLSX_JS
    assert "t(payload, item.unit)" in XLSX_JS
    assert "t(payload, field.label)" in XLSX_JS
    assert "cellStr(ref(1, row), field.id)" not in XLSX_JS
    assert "cellStr(ref(1, row), item.id)" not in XLSX_JS
    assert 'sheet name="Inputs"' not in XLSX_JS
    assert "hiddenHelper" in XLSX_JS


def _load_lookups() -> dict[str, dict[str, str]]:
    out = {}
    for locale in ("zh", "en"):
        data = json.loads((ROOT / "i18n" / f"aidc-investment-roi.{locale}.json").read_text(encoding="utf-8"))
        out[locale] = data.get("lookup") or {}
    return out


def _build_files_via_node(locale: str) -> dict[str, str]:
    script = r"""
const fs = require('fs');
const vm = require('vm');
const locale = process.argv[1];
const lookup = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).lookup || {};
const code = fs.readFileSync(process.argv[3], 'utf8');
const context = {
  TextEncoder, Uint8Array, DataView,
  Blob: class { constructor() {} },
  URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
  document: { createElement() { return { click() {}, remove() {}, href: '', download: '' }; }, body: { appendChild() {} } },
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(code, context);
const files = context.AidcInvestmentRoiXlsx.buildFiles({
  locale,
  t: (key) => (lookup[key] != null ? lookup[key] : key),
  inputs: { serviceModel: 'ds-v4' },
  computed: {},
  cloudCompare: {},
  activeScenario: 'ds-v4',
});
const out = {};
for (const file of files) {
  out[file.name] = typeof file.data === 'string' ? file.data : Buffer.from(file.data).toString('utf8');
}
process.stdout.write(JSON.stringify(out));
"""
    result = subprocess.run(
        [
            "node",
            "-e",
            script,
            locale,
            str(ROOT / "i18n" / f"aidc-investment-roi.{locale}.json"),
            str(ROOT / "js" / "aidc-investment-roi-xlsx.js"),
        ],
        check=True,
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    return json.loads(result.stdout)


def _inline_texts(xml: str) -> list[str]:
    return [m.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
            for m in re.findall(r"<t[^>]*>([^<]*)</t>", xml)]


def test_generated_workbook_uses_page_locale_names():
    if not shutil.which("node"):
        pytest.skip("node is not available")
    try:
        zh_files = _build_files_via_node("zh")
        en_files = _build_files_via_node("en")
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        raise AssertionError(f"node workbook build failed: {exc}") from exc

    zh_book = zh_files["xl/workbook.xml"]
    en_book = en_files["xl/workbook.xml"]
    assert 'name="输入"' in zh_book
    assert 'name="计算"' in zh_book
    assert 'name="云公开价"' in zh_book
    assert 'name="Inputs"' in en_book
    assert 'name="Model"' in en_book
    assert 'name="Cloud list prices"' in en_book
    assert "'输入'!$B$" in zh_book
    assert "Inputs!$B$" in en_book

    zh_texts = _inline_texts(zh_files["xl/worksheets/sheet1.xml"]) + _inline_texts(zh_files["xl/worksheets/sheet2.xml"])
    en_texts = _inline_texts(en_files["xl/worksheets/sheet1.xml"]) + _inline_texts(en_files["xl/worksheets/sheet2.xml"])
    assert "算力规模（P）" in zh_texts
    assert "Compute scale (P)" in en_texts
    assert "字段 ID" not in zh_texts
    assert "Field ID" not in en_texts
    assert "computeP" not in zh_texts
    assert "computeP" not in en_texts
    assert not any(re.search(r"[\u4e00-\u9fff]", text) for text in en_texts if text)
    lookups = _load_lookups()
    assert lookups["en"]["输入"] == "Inputs"
    assert lookups["zh"]["输入"] == "输入"


def test_core_formulas_use_page_constants():
    formulas = parse_model_formulas()
    assert formulas["ascendCost"] == "npuCount*npuUnitPrice*10000"
    assert formulas["itEquipment"] == "IF(ascendPct>0,ascendCost/ascendPct,NA())"
    assert formulas["totalCapex"] == "IF(itPct>0,itEquipment/itPct,NA())"
    assert formulas["annualPower"] == "clusterMw*1000*8760*pue*util*elecPrice"
    assert formulas["annualMissTokens"] == "npuCount*tpsInputMiss*86400*365*util"
    assert formulas["costPerMOut"] == "IF(outputTokensM>0,annualCost*mixOut/outputTokensM,NA())"
    assert formulas["annualCost"] == "annualDep+annualPower+annualOps"
