"""Python ports of page formulas for golden tests.

Keep in sync with:
- js/index-page.js computeStandardKvCacheBytes / computeMlaKvCacheBytes
- js/aidc-investment-roi-page.js tokenMix / blendedCloudPrice / formatYiPerDay
"""

from __future__ import annotations

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
