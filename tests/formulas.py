"""Python ports of page formulas for golden tests.

Keep in sync with:
- js/index-page.js computeStandardKvCacheBytes / computeMlaKvCacheBytes
- js/aidc-investment-roi-page.js tokenMix / blendedCloudPrice / formatYiPerDay / readState
- js/aidc-investment-roi-xlsx.js MODEL_FORMULAS
- ai-dc-computeEst.html calculate() and scenarios.coding
- ai-dc-tcp.html COMMON / SC
- js/ai-dc-schedule-budget-model.js calculateScenario / compareScenarios

TCP 2026-09 overview golden defaults (ai-dc-tcp.html COMMON + SC):
dau=12700 / 9525, pen=100, tin=9_900_000, tout=100_000, hit=0, M=3, N=45, K=1.2, C_card=919
→ daily tokens 127_000_000_000 / 95_250_000_000, cards 1024 / 768
→ room power round(2096×1.20)=2515 kW / round(2500×1.50)=3750 kW

computeEst coding golden (ai-dc-computeEst.html scenarios.coding; same inputs as TCP 1024):
dau=12700, pen=100, tin=9_900_000, tout=100_000, hit=0, M=3, N=45, K=1.2, C_card=919
→ daily tokens 127_000_000_000, cards 1024

Schedule-budget golden (js/ai-dc-schedule-budget.js SCENARIO_DEFAULTS, 1024 cards, $8/W, $0.132/kWh, 5y):
air 3kW/card PUE1.5 $85000 2.5% O&M; liquid 2kW/card PUE1.2 $110000 3% O&M
年 OPEX = 年电费 + CAPEX×运维费率
"""

from __future__ import annotations

import math
from typing import Mapping

SEC_PER_DAY = 86400
YI = 1e8


def compute_standard_kv_cache_bytes(
    layers: int,
    kv_heads: int,
    head_dim: int,
    seq_len: int,
    batch_size: int,
    dtype_bytes: float,
) -> float:
    return 2 * layers * kv_heads * head_dim * seq_len * batch_size * dtype_bytes


def compute_mla_kv_cache_bytes(
    layers: int,
    compressed_kv_dim: int,
    rope_head_dim: int,
    seq_len: int,
    batch_size: int,
    dtype_bytes: float,
) -> float:
    per_layer_per_token = compressed_kv_dim + rope_head_dim
    return layers * per_layer_per_token * seq_len * batch_size * dtype_bytes


def js_round(value: float) -> int:
    """Match JavaScript Math.round (half away from zero for positives)."""
    if value >= 0:
        return int(math.floor(value + 0.5))
    return int(math.ceil(value - 0.5))


def roi_state(inp: Mapping[str, float | str], refs: Mapping[str, float]) -> dict[str, float]:
    """Port of aidc-investment-roi-page.js readState() in yuan / fraction units."""
    compute_p = float(inp["computeP"])
    cluster_mw = float(inp["clusterMw"])
    npu_count = js_round(compute_p)
    unit_price_wan = float(inp["npuUnitPrice"])
    ascend_pct = float(inp["ascendInItPct"]) / 100
    it_pct = float(inp["pctItDevice"]) / 100
    power_pct = float(inp["pctPowerCool"]) / 100
    land_pct = float(inp["pctLandBuild"]) / 100
    deprec_years = float(inp["deprecYears"])
    pue = float(inp["pue"])
    elec_price = float(inp["elecPrice"])
    utilization = float(inp["utilization"]) / 100
    annual_fixed_opex_yuan = float(inp["annualFixedOpex"]) * 10000
    capex_opex_pct = float(inp["capexOpexPct"]) / 100
    tps_miss = float(inp["tpsInputMiss"])
    tps_hit = float(inp["tpsInputHit"])
    tps_out = float(inp["tpsOutput"])
    mix_miss = float(inp["pctMixMiss"]) / 100
    mix_hit = float(inp["pctMixHit"]) / 100
    mix_out = float(inp["pctMixOut"]) / 100

    ascend_cost = npu_count * unit_price_wan * 10000
    it_equipment = ascend_cost / ascend_pct if ascend_pct > 0 else math.nan
    total_capex = it_equipment / it_pct if it_pct > 0 else math.nan
    annual_miss = npu_count * tps_miss * 86400 * 365 * utilization
    annual_hit = npu_count * tps_hit * 86400 * 365 * utilization
    annual_out = npu_count * tps_out * 86400 * 365 * utilization
    annual_total = annual_miss + annual_hit + annual_out
    annual_dep = total_capex / deprec_years
    annual_power = cluster_mw * 1000 * 8760 * pue * utilization * elec_price
    annual_maint = total_capex * capex_opex_pct
    annual_ops = annual_fixed_opex_yuan + annual_maint
    annual_cost = annual_dep + annual_power + annual_ops
    miss_m = annual_miss / 1e6
    hit_m = annual_hit / 1e6
    out_m = annual_out / 1e6
    total_m = annual_total / 1e6
    cost_miss = (annual_cost * mix_miss) / miss_m if miss_m > 0 else math.nan
    cost_hit = (annual_cost * mix_hit) / hit_m if hit_m > 0 else math.nan
    cost_out = (annual_cost * mix_out) / out_m if out_m > 0 else math.nan
    cost_per_m = annual_cost / out_m if out_m > 0 else math.nan
    cost_blended = annual_cost / total_m if total_m > 0 else math.nan
    mix = token_mix(tps_miss, tps_hit, tps_out)
    ref_blended = (
        mix["miss"] * float(refs["refInputMiss"])
        + mix["hit"] * float(refs["refInputHit"])
        + mix["out"] * float(refs["refOutput"])
    )
    revenue = total_m * ref_blended
    profit = revenue - annual_cost
    fixed = annual_dep + annual_ops
    tokens_base_m = total_m / utilization if utilization > 0 else 0.0
    power_base = annual_power / utilization if utilization > 0 else annual_power
    marginal = ref_blended * tokens_base_m - power_base
    breakeven = fixed / marginal if marginal > 0 else math.nan
    payback = total_capex / profit if profit > 0 else math.nan
    return {
        "npuCount": npu_count,
        "ascendCost": ascend_cost,
        "itEquipment": it_equipment,
        "totalCapex": total_capex,
        "powerCapex": total_capex * power_pct,
        "landCapex": total_capex * land_pct,
        "annualMissTokens": annual_miss,
        "annualHitTokens": annual_hit,
        "annualOutputTokens": annual_out,
        "annualTotalTokens": annual_total,
        "annualDep": annual_dep,
        "annualPower": annual_power,
        "annualMaint": annual_maint,
        "annualFixedOpexYuan": annual_fixed_opex_yuan,
        "annualOps": annual_ops,
        "annualOpexTotal": annual_power + annual_ops,
        "annualCost": annual_cost,
        "annualCostPerDay": annual_cost / 365,
        "costPerMMiss": cost_miss,
        "costPerMHit": cost_hit,
        "costPerMOut": cost_out,
        "costPerM": cost_per_m,
        "costPerMBlended": cost_blended,
        "refBlended": ref_blended,
        "revenue": revenue,
        "profit": profit,
        "breakeven": breakeven,
        "payback": payback,
        "utilization": utilization,
        "ascendPct": ascend_pct,
        "itPct": it_pct,
        "powerPct": power_pct,
        "landPct": land_pct,
    }


def token_mix(tps_miss: float, tps_hit: float, tps_out: float) -> dict[str, float]:
    total = tps_miss + tps_hit + tps_out
    if total <= 0:
        return {"miss": 0.0, "hit": 0.0, "out": 0.0}
    return {
        "miss": tps_miss / total,
        "hit": tps_hit / total,
        "out": tps_out / total,
    }


def blended_cloud_price(cloud: Mapping[str, float], mix: Mapping[str, float]) -> float:
    return mix["miss"] * cloud["inputMiss"] + mix["hit"] * cloud["inputHit"] + mix["out"] * cloud["output"]


def tps_to_yi_per_day(tps: float) -> float:
    return tps * SEC_PER_DAY / YI


def yi_per_day_to_tps(yi: float) -> float:
    return yi * YI / SEC_PER_DAY


GIB = 1024**3


def daily_tokens(
    dau: float,
    penetration_pct: float,
    in_tokens: float,
    out_tokens: float,
    cache_hit_pct: float,
) -> float:
    """TCP / computeEst: U0 × (Tout + Tin × (1 − H))."""
    active_users = dau * penetration_pct / 100
    per_user = out_tokens + in_tokens * (1 - cache_hit_pct / 100)
    return active_users * per_user


def compute_cards(
    token_per_sec: float,
    flops_multiplier: float,
    active_params_b: float,
    peak_multiplier: float,
    utilization_pct: float,
    compute_margin: float,
    card_tflops: float,
) -> int:
    """computeEst: n_compute = ceil(C_raw × K / C_card). utilization_pct is N as percent."""
    base_flops = (
        token_per_sec
        * flops_multiplier
        * (active_params_b * 1e9)
        * peak_multiplier
        / (utilization_pct / 100)
    )
    card_flops = card_tflops * 1e12
    return math.ceil(base_flops * compute_margin / card_flops)


def min_hbm_cards(
    total_params_b: float,
    weight_precision: float,
    card_vram_gb: float,
    vram_usable_pct: float,
) -> int:
    weight_bytes = total_params_b * 1e9 * weight_precision
    usable = card_vram_gb * GIB * (vram_usable_pct / 100)
    return math.ceil(weight_bytes / usable)


def planned_cards(compute: int, memory_min: int) -> int:
    return max(compute, memory_min)


def room_power_kw(design_kw: float, pue: float) -> int:
    """TCP roomPowerKW: P_room = round(P_IT × PUE), kW integer."""
    return round(design_kw * pue)


def schedule_scenario(
    cards: float,
    card_power_kw: float,
    pue: float,
    unit_cost: float,
    infra_per_w: float,
    electricity: float,
    years: float,
    maintenance_rate: float = 0.0,
) -> dict[str, float] | None:
    """机房工期和造价。非法输入返回 None，不传播 NaN。

    ICT MW = cards × kW/card / 1000
    机房 MW = ICT MW × PUE
    L0+L1 = 机房 MW × 10⁶ × $/W
    ICT = cards × $/card
    年电费 = 机房 MW × 1000 × 8760 × $/kWh
    年运维 = CAPEX × 运维费率(%) / 100
    年 OPEX = 年电费 + 年运维
    """
    values = (
        cards,
        card_power_kw,
        pue,
        unit_cost,
        infra_per_w,
        electricity,
        years,
        maintenance_rate,
    )
    if any(not math.isfinite(value) for value in values):
        return None
    if cards < 1 or pue < 1 or years < 1:
        return None
    if card_power_kw < 0 or unit_cost < 0 or infra_per_w < 0 or electricity < 0:
        return None
    if maintenance_rate < 0 or maintenance_rate > 100:
        return None
    ict_mw = cards * card_power_kw / 1000
    facility_mw = ict_mw * pue
    ict_cost = cards * unit_cost
    infra_cost = facility_mw * 1e6 * infra_per_w
    capex = ict_cost + infra_cost
    annual_electricity = facility_mw * 1000 * 8760 * electricity
    annual_maintenance = capex * maintenance_rate / 100
    annual_opex = annual_electricity + annual_maintenance
    opex = annual_opex * years
    return {
        "ict_mw": ict_mw,
        "facility_mw": facility_mw,
        "ict_cost": ict_cost,
        "infra_cost": infra_cost,
        "capex": capex,
        "annual_electricity": annual_electricity,
        "annual_maintenance": annual_maintenance,
        "annual_opex": annual_opex,
        "opex": opex,
        "total": capex + opex,
    }


def schedule_compare(air: Mapping[str, float], liquid: Mapping[str, float]) -> dict[str, float | None]:
    capex_premium = liquid["capex"] - air["capex"]
    opex_saving = air["opex"] - liquid["opex"]
    total_saving = air["total"] - liquid["total"]
    annual_saving = air["annual_opex"] - liquid["annual_opex"]
    payback = capex_premium / annual_saving if capex_premium > 0 and annual_saving > 0 else None
    return {
        "capex_premium": capex_premium,
        "opex_saving": opex_saving,
        "total_saving": total_saving,
        "annual_saving": annual_saving,
        "payback": payback,
    }
