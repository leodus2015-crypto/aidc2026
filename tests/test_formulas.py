from formulas import (
    blended_cloud_price,
    compute_mla_kv_cache_bytes,
    compute_standard_kv_cache_bytes,
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
