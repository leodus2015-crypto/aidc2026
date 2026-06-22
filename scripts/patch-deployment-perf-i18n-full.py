#!/usr/bin/env python3
"""Add data-dp-i18n-html keys for long paragraphs + merge into i18n JSON."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "ai-dc-deployment-perf.html"

# Keys use Chinese as lookup id; values are EN (html allowed for data-dp-i18n-html)
HTML_I18N: dict[str, str] = {
    "dp.synFoot": (
        "AI 存储<strong>持久化写入 KV Cache</strong>；同前缀请求到来，直接从存储<strong>多级缓存召回</strong>，"
        "<strong>跳过完整 Prefill</strong>，128K 输入/1K 输出场景下 TTFT 从 9100 ms 降至 4400 ms（降幅 52%），算力 100% 投入 Decode。"
    ),
    "dp.cloudPara": (
        "白天（08–22时）多用户弹性扩容推理实例，NPU 利用率实时跟随业务量；业务峰值时自动<strong>按需扩容</strong>；"
        "夜间（22–08时）闲置推理算力<strong>无缝切换训练任务</strong>。传统方案训练与推理独占各自服务器、互不调配，"
        "白天仅推理柜运行、夜间仅训练柜运行，综合算力利用率不足 <strong style=\"color:#64748b\">30%</strong>；"
        "算云协同将同一套硬件利用率稳定控制在 <strong style=\"color:var(--bus)\">50–80%</strong> 区间，"
        "提升 <strong style=\"color:var(--bus)\">2×</strong> 以上。"
    ),
    "dp.sloPara": (
        "请求遵循<strong>高 SLO 等级后到先得</strong>，L1 实时请求无需排队直接优先处理；推理实例按忙闲排序，"
        "<strong>空闲实例靠前</strong>优先承接；双队列匹配机制保障 SLO 达成率稳定在 "
        "<strong style=\"color:var(--bus)\">98%+</strong>，同时支持多业务场景共用模型实例，算力利用率提升 "
        "<strong style=\"color:var(--ai)\">40%</strong>。"
    ),
}

HTML_I18N_EN: dict[str, str] = {
    "dp.synFoot": (
        "AI Storage <strong>persistently writes KV Cache</strong>; when a request shares the same prefix, "
        "storage <strong>recalls from the multi-tier cache</strong> and <strong>skips full Prefill</strong>. "
        "At 128K input / 1K output, TTFT drops from 9100 ms to 4400 ms (−52%); 100% of compute goes to Decode."
    ),
    "dp.cloudPara": (
        "08:00–22:00: multi-user elastic inference scales with load; NPU utilization tracks demand and "
        "<strong>scales on demand</strong> at peak. 22:00–08:00: idle inference capacity "
        "<strong>seamlessly switches to training</strong>. Traditional siloed training/inference servers leave "
        "racks idle half the day—combined utilization below <strong style=\"color:#64748b\">30%</strong>. "
        "Compute–cloud synergy keeps the same hardware in a "
        "<strong style=\"color:var(--bus)\">50–80%</strong> band, an uplift of "
        "<strong style=\"color:var(--bus)\">2×</strong> or more."
    ),
    "dp.sloPara": (
        "Requests follow <strong>higher-SLO first-come-first-served</strong>; L1 real-time requests skip the queue. "
        "Instances are sorted by load with <strong>idle instances first</strong>. Dual-queue matching keeps SLO "
        "attainment at <strong style=\"color:var(--bus)\">98%+</strong> while sharing model instances across "
        "scenarios—utilization up <strong style=\"color:var(--ai)\">40%</strong>."
    ),
    "OceanStor AI 存储 · KV Cache UCM 多级缓存协同": "OceanStor AI Storage · KV Cache UCM multi-tier synergy",
    "ModelArts · 弹性推理调度引擎": "ModelArts · elastic inference scheduler",
    "存算架构 · 1通算柜 + 4智算柜": "Architecture · 1 general-compute rack + 4 AI racks",
    "NPU · HBM L1 缓存": "NPU · HBM L1 cache",
    "HBM 占用（KV Cache 近满）": "HBM usage (KV Cache nearly full)",
    "NVMe SSD · L2 缓存": "NVMe SSD · L2 cache",
    "OceanStor AI 存储 · L3": "OceanStor AI Storage · L3",
    "KV Cache 持久化存储块": "KV Cache persistent blocks",
    "TTFT 首Token延迟": "TTFT (time to first token)",
    "TTFT 降低（以查代算）": "TTFT reduction (cache-assisted compute)",
    "无缓存 <strong style=\"color:var(--t2)\">9100ms</strong> → 缓存命中 <strong style=\"color:var(--bus)\">4400ms</strong>":
        "No cache <strong style=\"color:var(--t2)\">9100ms</strong> → cache hit <strong style=\"color:var(--bus)\">4400ms</strong>",
    "Token/天 (12柜96卡)": "Tokens/day (12 racks, 96 cards)",
    "无缓存：<strong style=\"color:var(--t2)\">338M</strong> / 卡 · <strong style=\"color:var(--t2)\">32.45B</strong>/天<br>提升 <strong style=\"color:var(--cmp)\">↑68%</strong>":
        "No cache: <strong style=\"color:var(--t2)\">338M</strong>/card · <strong style=\"color:var(--t2)\">32.45B</strong>/day<br>Gain <strong style=\"color:var(--cmp)\">↑68%</strong>",
    "Prefill 跳过": "Prefill skipped",
    "Token 前缀": "Token prefix",
    "算力投入 Decode": "compute to Decode",
    "◈传统方案（无算云协同）": "◈ Traditional (no compute–cloud synergy)",
    "✦算云协同方案": "✦ Compute–cloud synergy",
    "训练/推理各自独占 · 互不调配 · 大量闲置": "Training/inference siloed · no sharing · heavy idle time",
    "12 × 算力柜（静态独占）": "12 × compute racks (static dedication)",
    "12 × 算力柜（弹性调度）": "12 × compute racks (elastic scheduling)",
    "平均算力利用率 <strong style=\"color:#10b981;\">↑2×</strong>": "Average compute utilization <strong style=\"color:#10b981;\">↑2×</strong>",
    "算力利用率<br>vs. 静态独占 <30%": "Compute utilization<br>vs. static dedication &lt;30%",
    "SLO 达成率<br>稳定保障": "SLO attainment<br>stable guarantee",
    "算力利用率提升<br>推理/训练混合调度": "Utilization uplift<br>mixed inference/training",
    "共用模型实例<br>业务敏捷弹性": "Shared model instances<br>agile elasticity",
    "模型": "Model",
    "每台AI服务器": "Per AI server",
    "8卡昇腾NPU": "8 Ascend NPUs",
    "等待推理请求...": "Waiting for inference requests...",
    "NPU 就绪，KV Cache 服务运行中": "NPU ready, KV Cache service running",
    "📐 测试场景": "📐 Test scenario",
    "KV Cache Pool · PB级 · 500 GB/s · ~1ms": "KV Cache Pool · PB-scale · 500 GB/s · ~1ms",
}


def merge_json() -> None:
    for loc in ("zh", "en"):
        p = ROOT / "i18n" / f"ai-dc-deployment-perf.{loc}.json"
        data = json.loads(p.read_text(encoding="utf-8"))
        lookup = data.setdefault("lookup", {})
        for k, zh in HTML_I18N.items():
            lookup[k] = zh if loc == "zh" else HTML_I18N_EN[k]
        for k, en in HTML_I18N_EN.items():
            if k.startswith("dp."):
                continue
            lookup[k] = k if loc == "zh" else en
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_html() -> None:
    text = HTML.read_text(encoding="utf-8")

    # Remove site header + lang switch (iframe uses parent switch)
    text = text.replace(
        """<header class="aidc-chrome shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur" style="margin-bottom:16px;">
  <nav class="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6" data-i18n-aria-label="nav.aria" aria-label="主导航">
    <a href="index.html" class="flex shrink-0 items-center" data-i18n-aria-label="nav.homeAria" aria-label="AIDC 2026 · 首页">
      <img src="aidc2026-logo.svg" alt="AIDC 2026" width="593" height="118" class="h-7 w-auto object-contain sm:h-8" data-i18n-alt="nav.homeAria" />
    </a>
    <p class="hidden text-sm font-semibold text-slate-800 sm:block" data-dp-i18n="AI DC · 部署 & 协同特性">AI DC · 部署 &amp; 协同特性</p>
    <ul class="flex flex-wrap items-center gap-4 text-xs font-semibold sm:gap-5 sm:text-sm">
      <li><a href="ai-dc-design.html" class="text-blue-700" data-i18n="nav.aiDcLayout">AI DC规划</a></li>
      <li><a href="index.html#inference" class="text-slate-600 hover:text-slate-950" data-i18n="nav.inference">Agentic推理</a></li>
      <li><a href="post-training.html" class="text-slate-600 hover:text-slate-950" data-i18n="nav.postTraining">后训练</a></li>
      <li><a href="white-paper.html" class="text-slate-600 hover:text-slate-950" data-i18n="nav.whitePaper">白皮书</a></li>
    </ul>
    <div id="lang-switch-root" class="ml-auto shrink-0"></div>
  </nav>
</header>

""",
        "",
    )

    # Remove lang-switch.js
    text = text.replace('<script src="js/lang-switch.js?v=6"></script>\n', "")

    # Fix broken badge
    text = text.replace(
        '<div class="ctitle-badge" style="background:rgba(139,92,246,.08);color:var(--cmp);border-color:rgba(139,92,246,.2);">OceanStor AI 存储 · ${L(\'KV Cache UCM 多级缓存协同\')}</div>',
        '<div class="ctitle-badge" style="background:rgba(139,92,246,.08);color:var(--cmp);border-color:rgba(139,92,246,.2);"><span data-dp-i18n="OceanStor AI 存储 · KV Cache UCM 多级缓存协同">OceanStor AI 存储 · KV Cache UCM 多级缓存协同</span></div>',
    )

    replacements = [
        (
            '<p class="syn-foot" style="font-size:10.5px;color:var(--t2);line-height:1.8;font-family:\'Microsoft YaHei\',\'微软雅黑\',sans-serif;">\n        AI 存储<strong>持久化写入 KV Cache</strong>；同前缀请求到来，直接从存储<strong>多级缓存召回</strong>，<strong>跳过完整 Prefill</strong>，128K 输入/1K 输出场景下 TTFT 从 9100 ms 降至 4400 ms（降幅 52%），算力 100% 投入 Decode。\n      </p>',
            '<p class="syn-foot" style="font-size:10.5px;color:var(--t2);line-height:1.8;font-family:\'Microsoft YaHei\',\'微软雅黑\',sans-serif;" data-dp-i18n-html="dp.synFoot">\n        AI 存储<strong>持久化写入 KV Cache</strong>；同前缀请求到来，直接从存储<strong>多级缓存召回</strong>，<strong>跳过完整 Prefill</strong>，128K 输入/1K 输出场景下 TTFT 从 9100 ms 降至 4400 ms（降幅 52%），算力 100% 投入 Decode。\n      </p>',
        ),
        (
            '<p style="margin-top:7px;font-size:9.5px;color:var(--t2);line-height:1.75;font-family:\'Microsoft YaHei\',\'微软雅黑\',sans-serif;">\n      白天（08–22时）多用户弹性扩容推理实例，NPU 利用率实时跟随业务量；业务峰值时自动<strong>按需扩容</strong>；夜间（22–08时）闲置推理算力<strong>无缝切换训练任务</strong>。传统方案训练与推理独占各自服务器、互不调配，白天仅推理柜运行、夜间仅训练柜运行，综合算力利用率不足 <strong style="color:#64748b">30%</strong>；算云协同将同一套硬件利用率稳定控制在 <strong style="color:var(--bus)">50–80%</strong> 区间，提升 <strong style="color:var(--bus)">2×</strong> 以上。\n    </p>',
            '<p style="margin-top:7px;font-size:9.5px;color:var(--t2);line-height:1.75;font-family:\'Microsoft YaHei\',\'微软雅黑\',sans-serif;" data-dp-i18n-html="dp.cloudPara">\n      白天（08–22时）多用户弹性扩容推理实例，NPU 利用率实时跟随业务量；业务峰值时自动<strong>按需扩容</strong>；夜间（22–08时）闲置推理算力<strong>无缝切换训练任务</strong>。传统方案训练与推理独占各自服务器、互不调配，白天仅推理柜运行、夜间仅训练柜运行，综合算力利用率不足 <strong style="color:#64748b">30%</strong>；算云协同将同一套硬件利用率稳定控制在 <strong style="color:var(--bus)">50–80%</strong> 区间，提升 <strong style="color:var(--bus)">2×</strong> 以上。\n    </p>',
        ),
        (
            '<p style="margin-top:7px;font-size:9.5px;color:var(--t2);line-height:1.75;font-family:\'Microsoft YaHei\',\'微软雅黑\',sans-serif;">\n      请求遵循<strong>高 SLO 等级后到先得</strong>，L1 实时请求无需排队直接优先处理；推理实例按忙闲排序，<strong>空闲实例靠前</strong>优先承接；双队列匹配机制保障 SLO 达成率稳定在 <strong style="color:var(--bus)">98%+</strong>，同时支持多业务场景共用模型实例，算力利用率提升 <strong style="color:var(--ai)">40%</strong>。\n    </p>',
            '<p style="margin-top:7px;font-size:9.5px;color:var(--t2);line-height:1.75;font-family:\'Microsoft YaHei\',\'微软雅黑\',sans-serif;" data-dp-i18n-html="dp.sloPara">\n      请求遵循<strong>高 SLO 等级后到先得</strong>，L1 实时请求无需排队直接优先处理；推理实例按忙闲排序，<strong>空闲实例靠前</strong>优先承接；双队列匹配机制保障 SLO 达成率稳定在 <strong style="color:var(--bus)">98%+</strong>，同时支持多业务场景共用模型实例，算力利用率提升 <strong style="color:var(--ai)">40%</strong>。\n    </p>',
        ),
        ('<div class="syn-sec-title">存算架构 · 1通算柜 + 4智算柜</div>', '<div class="syn-sec-title" data-dp-i18n="存算架构 · 1通算柜 + 4智算柜">存算架构 · 1通算柜 + 4智算柜</div>'),
        ('<div class="syn-sec-title">KV Cache 三级缓存 · 查询数据流（实时演示）</div>', '<div class="syn-sec-title" data-dp-i18n="KV Cache 三级缓存 · 查询数据流（实时演示）">KV Cache 三级缓存 · 查询数据流（实时演示）</div>'),
        ('<div class="ccs-sec-title">特性一 &nbsp;·&nbsp; 算力动态弹性 · 白天推理 / 夜间训练</div>', '<div class="ccs-sec-title" data-dp-i18n="特性一 · 算力动态弹性 · 白天推理 / 夜间训练">特性一 &nbsp;·&nbsp; 算力动态弹性 · 白天推理 / 夜间训练</div>'),
        ('<div class="ccs-sec-title">特性二 &nbsp;·&nbsp; 基于 SLO 弹性调度 &nbsp;·&nbsp; 双队列动态匹配</div>', '<div class="ccs-sec-title" data-dp-i18n="特性二 · 基于 SLO 弹性调度 · 双队列动态匹配">特性二 &nbsp;·&nbsp; 基于 SLO 弹性调度 &nbsp;·&nbsp; 双队列动态匹配</div>'),
        ('<div class="pmi">模型 <strong>DeepSeek-V4-Flash</strong>', '<div class="pmi"><span data-dp-i18n="模型">模型</span> <strong>DeepSeek-V4-Flash</strong>'),
        ('<div class="pmi">每台AI服务器 <strong>8卡昇腾NPU</strong></div>', '<div class="pmi"><span data-dp-i18n="每台AI服务器">每台AI服务器</span> <strong data-dp-i18n="8卡昇腾NPU">8卡昇腾NPU</strong></div>'),
        ('<div class="ctitle-badge" style="background:rgba(16,185,129,.08);color:var(--bus);border-color:rgba(16,185,129,.2);">ModelArts · 弹性推理调度引擎</div>', '<div class="ctitle-badge" style="background:rgba(16,185,129,.08);color:var(--bus);border-color:rgba(16,185,129,.2);"><span data-dp-i18n="ModelArts · 弹性推理调度引擎">ModelArts · 弹性推理调度引擎</span></div>'),
    ]
    for old, new in replacements:
        if old in text:
            text = text.replace(old, new, 1)

    # bootstrap: no common needed when embedded (optional keep common:false to reduce load)
    text = text.replace(
        "AidcI18n.setLocale(locale, { page: 'ai-dc-deployment-perf', common: true, basePath: 'i18n/' });",
        "AidcI18n.setLocale(locale, { page: 'ai-dc-deployment-perf', common: false, basePath: 'i18n/' });",
    )

    HTML.write_text(text, encoding="utf-8")


def main() -> None:
    merge_json()
    patch_html()
    print("✓ full i18n patch done")


if __name__ == "__main__":
    main()
