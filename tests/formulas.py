"""Python ports of page formulas for golden tests.

Keep in sync with:
- js/index-page.js computeStandardKvCacheBytes / computeMlaKvCacheBytes
- js/aidc-investment-roi-page.js tokenMix / blendedCloudPrice / formatYiPerDay
- ai-dc-computeEst.html calculate() and scenarios.coding
- ai-dc-tcp.html COMMON / SC
- js/ai-dc-schedule-budget-model.js calculateScenario / compareScenarios

TCP 1024 / computeEst coding golden defaults (do not change unless product asks):
dau=3180, pen=60, tin=21_000_000, tout=300_000, hit=0, N=40, K=2.0, C_card=919
→ daily tokens 40_640_400_000, cards 1024
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


def schedule_scenario(
    cards: float,
    card_power_kw: float,
    pue: float,
    unit_cost: float,
    infra_per_w: float,
    electricity: float,
    years: float,
) -> dict[str, float] | None:
    """机房工期和造价。非法输入返回 None，不传播 NaN。

    ICT MW = cards × kW/card / 1000
    机房 MW = ICT MW × PUE
    L0+L1 = 机房 MW × 10⁶ × $/W
    ICT = cards × $/card
    年 OPEX = 机房 MW × 1000 × 8760 × $/kWh
    """
    values = (cards, card_power_kw, pue, unit_cost, infra_per_w, electricity, years)
    if any(not math.isfinite(value) for value in values):
        return None
    if cards < 1 or pue < 1 or years < 1:
        return None
    if card_power_kw < 0 or unit_cost < 0 or infra_per_w < 0 or electricity < 0:
        return None
    ict_mw = cards * card_power_kw / 1000
    facility_mw = ict_mw * pue
    ict_cost = cards * unit_cost
    infra_cost = facility_mw * 1e6 * infra_per_w
    capex = ict_cost + infra_cost
    annual_opex = facility_mw * 1000 * 8760 * electricity
    opex = annual_opex * years
    return {
        "ict_mw": ict_mw,
        "facility_mw": facility_mw,
        "ict_cost": ict_cost,
        "infra_cost": infra_cost,
        "capex": capex,
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
