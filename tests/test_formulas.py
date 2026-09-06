import pytest

from formulas import (
    blended_cloud_price,
    compute_cards,
    compute_mla_kv_cache_bytes,
    compute_standard_kv_cache_bytes,
    daily_tokens,
    min_hbm_cards,
    planned_cards,
    schedule_compare,
    schedule_scenario,
    token_mix,
    tps_to_yi_per_day,
    yi_per_day_to_tps,
)


def test_standard_kv_gqa_bf16():
    # 2 * 32 * 8 * 128 * 4096 * 1 * 2 = 536870912 bytes (0.5 GiB)
    bytes_ = compute_standard_kv_cache_bytes(
        layers=32,
        kv_heads=8,
        head_dim=128,
        seq_len=4096,
        batch_size=1,
        dtype_bytes=2,
    )
    assert bytes_ == 536870912
    assert abs(bytes_ / 1024**3 - 0.5) < 1e-12


def test_mla_kv_less_than_standard():
    layers, seq, batch, dtype = 61, 4096, 1, 2
    mla = compute_mla_kv_cache_bytes(
        layers=layers,
        compressed_kv_dim=512,
        rope_head_dim=64,
        seq_len=seq,
        batch_size=batch,
        dtype_bytes=dtype,
    )
    standard = compute_standard_kv_cache_bytes(
        layers=layers,
        kv_heads=128,
        head_dim=128,
        seq_len=seq,
        batch_size=batch,
        dtype_bytes=dtype,
    )
    assert mla == 61 * (512 + 64) * 4096 * 1 * 2
    assert mla < standard


def test_token_mix_normalizes_and_zero_total():
    mix = token_mix(100, 50, 50)
    assert abs(mix["miss"] - 0.5) < 1e-12
    assert abs(mix["hit"] - 0.25) < 1e-12
    assert abs(mix["out"] - 0.25) < 1e-12
    assert token_mix(0, 0, 0) == {"miss": 0.0, "hit": 0.0, "out": 0.0}


def test_blended_cloud_price():
    mix = token_mix(1, 1, 2)
    price = blended_cloud_price(
        {"inputMiss": 4.0, "inputHit": 2.0, "output": 8.0},
        mix,
    )
    assert abs(price - (0.25 * 4 + 0.25 * 2 + 0.5 * 8)) < 1e-12


def test_tps_yi_roundtrip():
    # 1e8 tokens / day = 1 亿/日 → tps = 1e8 / 86400
    tps = yi_per_day_to_tps(1.0)
    assert abs(tps - 1e8 / 86400) < 1e-9
    assert abs(tps_to_yi_per_day(tps) - 1.0) < 1e-9


def test_tcp_1024_daily_tokens_matches_preset():
    # Bound to ai-dc-tcp.html COMMON + SC["1024"].pen and computeEst scenarios.coding
    tokens = daily_tokens(3180, 60, 21_000_000, 300_000, 0)
    assert tokens == 40_640_400_000
    assert abs(tokens / 86400 - 470375) < 1e-6


def test_tcp_1024_compute_cards_matches_preset():
    cards = compute_cards(
        token_per_sec=470375,
        flops_multiplier=2,
        active_params_b=40,
        peak_multiplier=5,
        utilization_pct=40,
        compute_margin=2.0,
        card_tflops=919,
    )
    assert cards == 1024


def test_compute_est_zero_users_yields_zero_tokens():
    assert daily_tokens(1000, 0, 100, 10, 0) == 0


def test_hbm_floor_can_bind_planned_cards():
    compute = 8
    memory_min = min_hbm_cards(744, 2, 96, 80)
    assert memory_min >= 10
    assert planned_cards(compute, memory_min) == memory_min


def test_schedule_budget_default_air_and_liquid():
    air = schedule_scenario(1024, 3, 1.6, 85000, 8, 0.132, 5)
    liquid = schedule_scenario(1024, 2, 1.2, 110000, 8, 0.132, 5)
    assert air is not None and liquid is not None
    assert air["ict_mw"] == pytest.approx(3.072)
    assert air["facility_mw"] == pytest.approx(4.9152)
    assert air["ict_cost"] == 87_040_000
    assert air["infra_cost"] == pytest.approx(39_321_600)
    assert air["capex"] == pytest.approx(126_361_600)
    assert air["annual_opex"] == pytest.approx(5_683_544.064)
    assert liquid["ict_mw"] == pytest.approx(2.048)
    assert liquid["facility_mw"] == pytest.approx(2.4576)
    assert liquid["capex"] == pytest.approx(132_300_800)
    compared = schedule_compare(air, liquid)
    assert compared["capex_premium"] == 5_939_200
    assert compared["annual_saving"] == pytest.approx(2_841_772.032)
    assert compared["payback"] == pytest.approx(5_939_200 / 2_841_772.032)


def test_schedule_budget_country_china_case():
    air = schedule_scenario(1024, 3, 1.6, 85000, 3, 0.098, 5)
    assert air is not None
    assert air["infra_cost"] == pytest.approx(14_745_600)
    assert air["capex"] == pytest.approx(101_785_600)


def test_schedule_budget_rejects_invalid_inputs():
    assert schedule_scenario(0, 3, 1.6, 85000, 8, 0.132, 5) is None
    assert schedule_scenario(1024, 3, 0.9, 85000, 8, 0.132, 5) is None
    assert schedule_scenario(1024, 3, 1.6, 85000, 8, -0.1, 5) is None
    assert schedule_scenario(1024, 3, 1.6, 85000, 8, 0.132, 0) is None
    assert schedule_scenario(float("nan"), 3, 1.6, 85000, 8, 0.132, 5) is None
