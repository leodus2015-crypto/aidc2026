#!/usr/bin/env python3
"""Patch ai-dc-deployment-perf.html for scheme-B i18n + generate JSON bundles."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "ai-dc-deployment-perf.html"

# Chinese → English lookup (keys are Chinese source strings)
EN: dict[str, str] = {
    "AI DC · 部署 & 协同特性": "AI DC · Deployment & Synergy",
    "部署 & 协同特性": "Deployment & Synergy",
    "HUAWEI AI DATA CENTER · 96 NPU · ASCEND · DEEPSEEK V4 FLASH · OCEANSTOR": "HUAWEI AI DATA CENTER · 96 NPU · ASCEND · DEEPSEEK V4 FLASH · OCEANSTOR",
    "AI DC · 机柜部署分布": "AI DC · Rack Deployment Layout",
    "12智算 + 6通算 + 2总线 = 20柜 · 96卡 · 正视图": "12 AI + 6 general compute + 2 bus = 20 racks · 96 cards · front view",
    "AI DC · 推理性能（昇腾智算柜）": "AI DC · Inference Performance (Ascend AI Racks)",
    "模型": "Model",
    "每台AI服务器": "Per AI server",
    "单机部署": "Single-node deployment",
    "PD 混部": "PD colocation",
    "1实例/柜 · 8卡": "1 instance/rack · 8 cards",
    "12 × 智算柜 · 每柜独立 1 个模型实例": "12 × AI racks · 1 model instance per rack",
    "Token / 天": "Tokens / day",
    "(12柜合计)": "(12 racks total)",
    "Token / 卡 / 天": "Tokens / card / day",
    "双机部署": "Dual-node deployment",
    "2柜/实例 · 16卡": "2 racks/instance · 16 cards",
    "12 × 智算柜 · 每 2 柜 1 实例，共 6 实例": "12 × AI racks · 1 instance per 2 racks, 6 instances total",
    "4机大EP": "4-node large EP",
    "PD 分离": "PD disaggregation",
    "4柜/实例 · 32卡": "4 racks/instance · 32 cards",
    "12 × 智算柜 · 每 4 柜 1 实例，共 3 实例": "12 × AI racks · 1 instance per 4 racks, 3 instances total",
    "算存协同": "Compute–Storage Synergy",
    "OceanStor AI 存储 · KV Cache UCM 多级缓存协同": "OceanStor AI Storage · KV Cache UCM multi-tier synergy",
    "存算架构 · 1通算柜 + 4智算柜": "Architecture · 1 general-compute rack + 4 AI racks",
    "AI 存储": "AI Storage",
    "AI 存储持久化写入 KV Cache": "AI storage persistently writes KV Cache",
    "多级缓存召回": "multi-tier cache recall",
    "跳过完整 Prefill": "skip full Prefill",
    "128K 输入/1K 输出场景下 TTFT 从 9100 ms 降至 4400 ms（降幅 52%），算力 100% 投入 Decode。": "At 128K input / 1K output, TTFT drops from 9100 ms to 4400 ms (−52%); 100% compute goes to Decode.",
    "KV Cache 三级缓存 · 查询数据流（实时演示）": "KV Cache three-tier · query data flow (live demo)",
    "等待推理请求...": "Waiting for inference requests...",
    "NPU 就绪，KV Cache 服务运行中": "NPU ready, KV Cache service running",
    "待机": "Standby",
    "📐 测试场景": "📐 Test scenario",
    "128K 输入 / 1K 输出": "128K input / 1K output",
    "NPU · HBM L1 缓存": "NPU · HBM L1 cache",
    "检索中": "Searching",
    "HBM 占用（KV Cache 近满）": "HBM usage (KV Cache nearly full)",
    "HBM 溢出 → SSD L2": "HBM overflow → SSD L2",
    "NVMe SSD · L2 缓存": "NVMe SSD · L2 cache",
    "SSD 未命中 → AI 存储 L3": "SSD miss → AI Storage L3",
    "OceanStor AI 存储 · L3": "OceanStor AI Storage · L3",
    "✓ 命中！": "✓ Hit!",
    "KV Cache 持久化存储块": "KV Cache persistent blocks",
    "命中率": "Hit rate",
    "TTFT 首Token延迟": "TTFT (time to first token)",
    "TTFT 降低（以查代算）": "TTFT reduction (cache-assisted compute)",
    "无缓存": "No cache",
    "缓存命中": "Cache hit",
    "E2E 吞吐": "End-to-end throughput",
    "Token/天 (12柜96卡)": "Tokens/day (12 racks, 96 cards)",
    "提升": "Gain",
    "缓存命中路径": "Cache hit path",
    "✦ 以查代算": "✦ Cache-assisted compute",
    "Prefill 跳过": "Prefill skipped",
    "Token 前缀": "Token prefix",
    "算力投入 Decode": "compute to Decode",
    "Cache 查询（下行）": "Cache query (downstream)",
    "以查代算 回程": "Cache-assisted return path",
    "命中块": "Hit block",
    "算云协同": "Compute–Cloud Synergy",
    "ModelArts · 弹性推理调度引擎": "ModelArts · elastic inference scheduler",
    "特性一 · 算力动态弹性 · 白天推理 / 夜间训练": "Feature 1 · Dynamic elasticity · daytime inference / nighttime training",
    "传统方案（无算云协同）": "Traditional (no compute–cloud synergy)",
    "平均算力利用率": "Average compute utilization",
    "训练/推理各自独占 · 互不调配 · 大量闲置": "Training/inference siloed · no sharing · heavy idle time",
    "12 × 算力柜（静态独占）": "12 × compute racks (static dedication)",
    "算云协同方案": "Compute–cloud synergy",
    "12 × 算力柜（弹性调度）": "12 × compute racks (elastic scheduling)",
    "▶ 重播": "▶ Replay",
    "⏸ 暂停": "⏸ Pause",
    "▶ 继续": "▶ Resume",
    "推理运行（白天）": "Inference (daytime)",
    "训练运行（夜间）": "Training (nighttime)",
    "弹性扩容峰值": "Elastic scale-out peak",
    "空闲浪费": "Idle waste",
    "特性二 · 基于 SLO 弹性调度 · 双队列动态匹配": "Feature 2 · SLO-based elastic scheduling · dual-queue matching",
    "📋 请求队列（SLO 等级排序）": "📋 Request queue (by SLO tier)",
    "🖥️ 推理实例队列（闲→忙排序）": "🖥️ Instance queue (idle → busy)",
    "匹配中": "Matching",
    "高 SLO 等级后到先得 · L1 直接插队": "Higher SLO first · L1 can jump queue",
    "空闲实例优先承接请求": "Idle instances take requests first",
    "ModelArts 请求调度器": "ModelArts request scheduler",
    "算力利用率": "Compute utilization",
    "vs. 静态独占 <30%": "vs. static dedication <30%",
    "SLO 达成率": "SLO attainment",
    "稳定保障": "Stable guarantee",
    "算力利用率提升": "Utilization uplift",
    "推理/训练混合调度": "Inference/training mixed scheduling",
    "多场景": "Multi-scenario",
    "共用模型实例": "Shared model instances",
    "业务敏捷弹性": "Agile business elasticity",
    "通算柜": "General Compute Rack",
    "智算柜": "AI Compute Rack",
    "总线柜": "Unified Bus Rack",
    "DeepSeek · Qwen · GLM 等 推理 & 训练": "DeepSeek · Qwen · GLM inference & training",
    "UnifiedBus 总线协议": "UnifiedBus protocol",
    "HCS 云底座 · ModelArts · ManageOne · CCAE": "HCS cloud · ModelArts · ManageOne · CCAE",
    "交换机": "Switch",
    "通用服务器": "General-purpose server",
    "AI服务器": "AI Server",
    "UB Box": "UB Box",
    "实例": "Instance",
    "KV Cache UCM 多级缓存协同": "KV Cache UCM multi-tier synergy",
    "SSD KV Cache 卸载至 AI 存储持久化": "SSD KV Cache offloaded to AI Storage persistence",
    "AI 智算柜 ×4": "AI compute racks ×4",
    "通算柜（OceanStor）": "General compute rack (OceanStor)",
    "系统就绪 · 等待推理请求": "System ready · awaiting inference",
    "HBM KV Cache 已满，SSD + AI 存储在线": "HBM KV Cache full; SSD + AI Storage online",
    "推理请求进入 NPU 队列": "Inference request enters NPU queue",
    "新请求到来，开始查找 KV Cache 前缀...": "New request; searching KV Cache prefix...",
    "请求": "Request",
    "查询 HBM L1 · 搜索中": "Query HBM L1 · searching",
    "片上 HBM 高速搜索 KV Cache 前缀块...": "On-chip HBM search for KV Cache prefix blocks...",
    "L1检索": "L1 lookup",
    "HBM L1 未命中": "HBM L1 miss",
    "HBM 近满 93%，目标 KV Cache 已被淘汰": "HBM ~93% full; target KV Cache evicted",
    "L1 MISS": "L1 MISS",
    "下行至 SSD L2": "Downstream to SSD L2",
    "查询路径延伸至本地 NVMe SSD 层...": "Query path extends to local NVMe SSD tier...",
    "→ SSD": "→ SSD",
    "查询 SSD L2 · 并行扫描": "Query SSD L2 · parallel scan",
    "并行扫描 4 路 NVMe SSD KV Cache...": "Parallel scan across 4 NVMe SSD KV Cache paths...",
    "L2检索": "L2 lookup",
    "SSD L2 未命中": "SSD L2 miss",
    "SSD 无匹配 KV Cache，升级至 AI 存储层": "No SSD match; escalate to AI Storage tier",
    "L2 MISS": "L2 MISS",
    "下行至 OceanStor AI 存储": "Downstream to OceanStor AI Storage",
    "查询路径延伸至远端 AI 存储池（~1ms）...": "Query path extends to remote AI Storage pool (~1 ms)...",
    "→ L3": "→ L3",
    "查询 AI 存储 L3 · 扫描中": "Query AI Storage L3 · scanning",
    "OceanStor KV Cache Pool 持久化前缀检索...": "OceanStor KV Cache Pool persistent prefix lookup...",
    "L3检索": "L3 lookup",
    "AI 存储 L3 命中！": "AI Storage L3 hit!",
    "KV Cache 命中！前缀命中率 90%，以查代算激活": "KV Cache hit! 90% prefix hit rate; cache-assisted compute active",
    "✓ HIT": "✓ HIT",
    "以查代算 · KV Cache 回传": "Cache-assisted · KV Cache return",
    "命中数据高速回传：AI存储→SSD→HBM→NPU Decode": "Hit data returns: AI Storage → SSD → HBM → NPU Decode",
    "回程": "Return",
    "推理结果输出": "Inference output",
    "TTFT 4400ms · Prefill 跳过 · Decode 吞吐满载": "TTFT 4400 ms · Prefill skipped · Decode at full throughput",
    "完成": "Done",
    "检索中...": "Searching...",
    "✗ 未命中": "✗ Miss",
    "查询...": "Querying...",
    "✦ 以查代算 激活": "✦ Cache-assisted active",
    "✓ 输出完成": "✓ Output complete",
    "MISS": "MISS",
    "HIT ✓": "HIT ✓",
    "🌙 夜间训练": "🌙 Nighttime training",
    "☀ 白天推理": "☀ Daytime inference",
    "⚡ 弹性扩容": "⚡ Elastic scale-out",
    "⚡ 弹性扩容中": "⚡ Elastic scale-out",
    "🔴 L1 · 实时交易风控": "🔴 L1 · Real-time transaction risk",
    "🔴 L1 · 实时欺诈监测": "🔴 L1 · Real-time fraud detection",
    "🟠 L2 · 智能投顾建议": "🟠 L2 · Robo-advisory",
    "🟠 L2 · 客户身份验证": "🟠 L2 · Customer identity verification",
    "🔵 L3 · 智能营销推荐": "🔵 L3 · Marketing recommendations",
    "🔵 L3 · 投资组合分析": "🔵 L3 · Portfolio analysis",
    "⚪ L4 · 市场趋势预测": "⚪ L4 · Market trend forecast",
    "⚪ L4 · 合规报告生成": "⚪ L4 · Compliance report generation",
    "🟢 实例 1 · 空闲": "🟢 Instance 1 · idle",
    "🟢 实例 2 · 空闲": "🟢 Instance 2 · idle",
    "🟢 实例 3 · 空闲": "🟢 Instance 3 · idle",
    "🟡 实例 4 · 处理中": "🟡 Instance 4 · processing",
    "🟡 实例 5 · 处理中": "🟡 Instance 5 · processing",
    "🔴 实例 6 · 高负载": "🔴 Instance 6 · high load",
    "✅ SLO 98%+": "✅ SLO 98%+",
    "L{idx}→实例 匹配": "L{idx}→instance match",
    "白天（08–22时）多用户弹性扩容推理实例，NPU 利用率实时跟随业务量；业务峰值时自动": "08:00–22:00: multi-user elastic inference; NPU utilization tracks load; at peak, auto",
    "按需扩容": "scale on demand",
    "夜间（22–08时）闲置推理算力": "22:00–08:00: idle inference capacity",
    "无缝切换训练任务": "seamlessly switches to training",
    "请求遵循": "Requests follow",
    "高 SLO 等级后到先得": "higher SLO first-come-first-served",
    "L1 实时请求无需排队直接优先处理；推理实例按忙闲排序，": "L1 real-time requests skip queue; instances sorted by load, ",
    "空闲实例靠前": "idle instances first",
    "优先承接；双队列匹配机制保障 SLO 达成率稳定在": "take priority; dual-queue matching keeps SLO attainment at",
    "同时支持多业务场景共用模型实例，算力利用率提升": "multi-scenario shared instances; utilization up",
}

# JS string replacements: exact Chinese substring → L('key') wrapped
JS_REPLACEMENTS: list[tuple[str, str]] = [
    ("label:'通算柜'", "label:L('通算柜')"),
    ("label:'智算柜'", "label:L('智算柜')"),
    ("label:'总线柜'", "label:L('总线柜')"),
    ("role:['HCS 云底座 · ModelArts · ManageOne · CCAE']", "role:[L('HCS 云底座 · ModelArts · ManageOne · CCAE')]"),
    ("role:['DeepSeek · Qwen · GLM 等 推理 &amp; 训练']", "role:[L('DeepSeek · Qwen · GLM 等 推理 & 训练')]"),
    ("role:['UnifiedBus 总线协议']", "role:[L('UnifiedBus 总线协议')]"),
    ('>交换机<', ">${L('交换机')}<"),
    ('>通用服务器<', ">${L('通用服务器')}<"),
    ('>AI存储<', ">${L('AI 存储')}<"),
    ('>AI服务器<', ">${L('AI服务器')}<"),
    ('>UB Box<', ">${L('UB Box')}<"),
    ('>实例 ${gi+1}<', ">${L('实例')} ${gi+1}<"),
    ('KV Cache UCM 多级缓存协同', "${L('KV Cache UCM 多级缓存协同')}"),
    ('SSD KV Cache 卸载至 AI 存储持久化', "${L('SSD KV Cache 卸载至 AI 存储持久化')}"),
    ('>AI 智算柜 ×4<', ">${L('AI 智算柜 ×4')}<"),
    ('>通算柜（OceanStor）<', ">${L('通算柜（OceanStor）')}<"),
    ("m.textContent='✦ 以查代算'", "m.textContent=L('✦ 以查代算')"),
    ("m.textContent='✦ 以查代算 激活'", "m.textContent=L('✦ 以查代算 激活')"),
    ("elElast.textContent = peak ? '⚡ 弹性扩容中' : ''", "elElast.textContent = peak ? L('⚡ 弹性扩容中') : ''"),
    ("elPhase.textContent = peak ? '⚡ 弹性扩容' : (day ? '☀ 白天推理' : '🌙 夜间训练')", "elPhase.textContent = peak ? L('⚡ 弹性扩容') : (day ? L('☀ 白天推理') : L('🌙 夜间训练'))"),
    ("statEl.textContent = `L${i+1}→实例 匹配`", "statEl.textContent = Lp('L{idx}→实例 匹配', { idx: i+1 })"),
    ("statEl.textContent = '✅ SLO 98%+'", "statEl.textContent = L('✅ SLO 98%+')"),
    ("statEl.textContent = '匹配中'", "statEl.textContent = L('匹配中')"),
    ("if(icon)icon.textContent=ph.icon; if(name)name.textContent=ph.name", "if(icon)icon.textContent=ph.icon; if(name)name.textContent=L(ph.name); if(desc)desc.textContent=L(ph.desc); if(tag)tag.textContent=L(ph.tag); ph.fn(); return"),
    ("if(desc)desc.textContent=ph.desc; if(tag)tag.textContent=ph.tag", ""),
    ("ph.fn();", ""),
]


def build_json() -> None:
    lookup = {k: v for k, v in EN.items()}
    # ensure all keys map to themselves in zh
    zh_lookup = {k: k for k in lookup}
    for k in list(lookup):
        if k not in zh_lookup:
            zh_lookup[k] = k

    zh = {
        "meta": {
            "title": "AI DC · 部署 & 协同特性",
            "description": "AI 数据中心部署分布、推理性能、算存协同与算云协同特性演示。",
        },
        "page": {
            "h1Prefix": "AI DC · ",
            "h1Span": "部署 & 协同特性",
            "subtitle": "HUAWEI AI DATA CENTER · 96 NPU · ASCEND · DEEPSEEK V4 FLASH · OCEANSTOR",
        },
        "lookup": zh_lookup,
    }
    en = {
        "meta": {
            "title": "AI DC · Deployment & Synergy",
            "description": "AI data center rack layout, inference performance, compute–storage and compute–cloud synergy demo.",
        },
        "page": {
            "h1Prefix": "AI DC · ",
            "h1Span": "Deployment & Synergy",
            "subtitle": "HUAWEI AI DATA CENTER · 96 NPU · ASCEND · DEEPSEEK V4 FLASH · OCEANSTOR",
        },
        "lookup": lookup,
    }
    (ROOT / "i18n" / "ai-dc-deployment-perf.zh.json").write_text(
        json.dumps(zh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (ROOT / "i18n" / "ai-dc-deployment-perf.en.json").write_text(
        json.dumps(en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def patch_html() -> None:
    text = HTML.read_text(encoding="utf-8")

    if "data-i18n-page" in text:
        print("HTML already patched")
        return

    # head: embed + asset version
    text = text.replace(
        "<html lang=\"zh-CN\">\n<head>",
        '<html lang="zh-CN">\n<head>\n<script src="js/aidc-asset-version.js?v=6"></script>\n<script src="js/embed-mode.js?v=6"></script>',
        1,
    )
    text = text.replace(
        "body{\n  background:var(--bg)",
        "html.aidc-embed .page-hdr-nav{display:none!important}\nhtml[lang=\"en\"] .pr-lbl{width:128px}\nhtml[lang=\"en\"] .synergy-left{width:320px}\nbody{\n  background:var(--bg)",
        1,
    )

    # header before .page
    header = """
<header class="page-hdr-nav" style="max-width:1200px;margin:0 auto 16px;padding:0 2px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
  <a href="index.html"><img src="aidc2026-logo.svg" alt="AIDC 2026" style="height:32px;width:auto;" /></a>
  <div style="display:flex;align-items:center;gap:16px;">
    <a href="ai-dc-design.html" style="font-size:13px;font-weight:700;color:#1d6fe5;text-decoration:none;" data-i18n="nav.aiDcLayout">AI DC规划</a>
    <div id="lang-switch-root"></div>
  </div>
</header>
"""
    text = text.replace('<div class="page">', header + '\n<div class="page">', 1)
    text = text.replace(
        '<body>',
        '<body data-i18n-page="ai-dc-deployment-perf">',
        1,
    )

    # script helpers at start
    helpers = """
function L(s) {
  if (!s || !window.AidcI18n) return s;
  const v = AidcI18n.getLookupText(s);
  return v != null ? v : s;
}
function Lp(key, params) {
  let t = L(key);
  if (params) Object.entries(params).forEach(([k, v]) => { t = t.replaceAll('{' + k + '}', String(v)); });
  return t;
}
function applyDpStaticI18n() {
  document.querySelectorAll('[data-dp-i18n]').forEach((el) => {
    const key = el.getAttribute('data-dp-i18n');
    if (!key) return;
    if (el.hasAttribute('data-dp-i18n-html')) el.innerHTML = L(key);
    else el.textContent = L(key);
  });
}
let _snRefreshPhase = null;
let _sloRefreshQueues = null;
let _ccRefreshLabels = null;

function refreshDeploymentPerfI18n() {
  applyDpStaticI18n();
  if (typeof drawFrontView === 'function') drawFrontView();
  if (typeof initPerfRows === 'function') initPerfRows();
  if (typeof initSynCard === 'function') initSynCard();
  if (_snRefreshPhase) _snRefreshPhase();
  if (_sloRefreshQueues) _sloRefreshQueues();
  if (_ccRefreshLabels) _ccRefreshLabels();
}
globalThis.__aidcPageRefreshI18n = refreshDeploymentPerfI18n;

"""
    text = text.replace("<script>\n// ══════════════════════════════════════════════════════════", "<script>\n" + helpers + "// ══════════════════════════════════════════════════════════", 1)

    for old, new in JS_REPLACEMENTS:
        if new:
            text = text.replace(old, new)

    # snSetPhase fix - remove duplicate lines if patch left artifacts
    text = re.sub(
        r"if\(name\)name\.textContent=L\(ph\.name\); if\(desc\)desc\.textContent=L\(ph\.desc\); if\(tag\)tag\.textContent=L\(ph\.tag\); ph\.fn\(\); return\s*\n\s*\n\s*",
        "if(name)name.textContent=L(ph.name); if(desc)desc.textContent=L(ph.desc); if(tag)tag.textContent=L(ph.tag); ph.fn(); return;\n    ",
        text,
    )

    # expose refresh hooks
    text = text.replace(
        "  snAnimId=requestAnimationFrame(snLoop);\n}",
        "  snAnimId=requestAnimationFrame(snLoop);\n  _snRefreshPhase = () => snSetPhase(snPhIdx);\n}",
        1,
    )
    text = text.replace(
        "  setInterval(()=>{\n    reqOffset = (reqOffset+2)%reqData.length;",
        "  _sloRefreshQueues = renderQueues;\n  setInterval(()=>{\n    reqOffset = (reqOffset+2)%reqData.length;",
        1,
    )

    # bootstrap footer
    footer = """
<script src="js/aidc-locale-bridge.js?v=6"></script>
<script src="js/i18n.js?v=6"></script>
<script src="js/lang-switch.js?v=6"></script>
<script src="js/i18n-bootstrap.js?v=6"></script>
<script>
  AidcI18nBootstrap.bootstrap('ai-dc-deployment-perf', {
    onReady: function () {
      globalThis.__aidcPageRefreshI18n?.();
      window.dispatchEvent(new Event('load'));
    },
    onLocaleChange: function () {
      document.documentElement.lang = AidcI18n.getLocale() === 'en' ? 'en' : 'zh-CN';
      globalThis.__aidcPageRefreshI18n?.();
    },
  });
  if (window.AidcLocaleBridge) {
    AidcLocaleBridge.initIframeListener(function (locale) {
      if (window.AidcI18n && AidcI18n.getLocale() !== locale) {
        AidcI18n.setLocale(locale, { page: 'ai-dc-deployment-perf', common: true, basePath: 'i18n/' });
      }
    }, { selfSource: 'ai-dc-deployment-perf' });
  }
</script>
"""
    text = text.replace(
        "window.addEventListener('load', ()=>{\n  drawFrontView();",
        "function bootDeploymentPerf() {\n  drawFrontView();",
        1,
    )
    text = text.replace(
        "  initSLOAnim();\n});",
        "  initSLOAnim();\n}\nwindow.addEventListener('load', bootDeploymentPerf);",
        1,
    )
    text = text.replace("</body>", footer + "\n</body>", 1)

    HTML.write_text(text, encoding="utf-8")


def main() -> None:
    build_json()
    patch_html()
    print("✓ i18n JSON + HTML patch done")


if __name__ == "__main__":
    main()
