#!/usr/bin/env python3
"""Patch index.html for scheme B i18n and emit js/index-page.js."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
OUT_JS = ROOT / "js" / "index-page.js"


def patch_html(html: str) -> str:
    html = html.replace(
        '<body class="min-h-screen bg-slate-50 text-slate-900">',
        '<body class="min-h-screen bg-slate-50 text-slate-900" data-i18n-page="index">',
    )
    html = html.replace('aria-label="主导航"', 'data-i18n-aria-label="nav.aria" aria-label="主导航"')
    html = html.replace(
        'aria-label="AIDC 2026 · 首页"',
        'data-i18n-aria-label="nav.homeAria" aria-label="AIDC 2026 · 首页"',
    )

    html = re.sub(
        r'<h1 class="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">\s*大模型推理HBM需求\s*</h1>',
        '<h1 class="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl" data-i18n="page.h1"></h1>',
        html,
        count=1,
    )
    html = re.sub(
        r'(<p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg">)\s*请选择.*?</p>',
        r'<p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg" data-i18n-html="page.intro"></p>',
        html,
        count=1,
        flags=re.S,
    )

    label_map = {
        "modelName": "form.modelName",
        "modelSize": "form.modelSize",
        "npuModel": "form.npuModel",
        "hbmCapacity": "form.hbmCapacity",
        "cardCount": "form.cardCount",
        "modelNameSep": "form.modelName",
        "modelSizeSep": "form.modelSize",
        "npuModelSep": "form.npuModel",
        "hbmCapacitySep": "form.hbmCapacity",
        "pdDeployMode": "form.pdDeployMode",
        "modelNameKvc": "form.modelName",
        "kvcModelSizeRo": "form.kvcModelSizeRo",
        "kvcLayersRo": "form.kvcLayersRo",
        "kvcExpertsRo": "form.kvcExpertsRo",
        "kvcKvHeadsRo": "form.kvcKvHeadsRo",
        "kvcHeadDimRo": "form.kvcHeadDimRo",
        "kvcQuantRo": "form.kvcQuantRo",
        "kvcDtypeSizeRo": "form.kvcDtypeSizeRo",
        "kvcBatchSize": "form.kvcBatchSize",
        "kvcTokenCount": "form.kvcTokenCount",
    }
    for fid, key in label_map.items():
        html = re.sub(
            rf'<label for="{re.escape(fid)}" class="block text-sm font-medium text-slate-700">[^<]+</label>',
            rf'<label for="{fid}" class="block text-sm font-medium text-slate-700" data-i18n="{key}"></label>',
            html,
        )

    html = html.replace(
        'placeholder="例如：284B、1.6T、72"',
        'data-i18n-placeholder="form.modelSizePlaceholder" placeholder="例如：284B、1.6T、72"',
    )
    html = html.replace(
        'title="随「NPU 型号」自动填充，不可手动修改"',
        'data-i18n-title="form.hbmCapacityTitle" title="随「NPU 型号」自动填充，不可手动修改"',
    )
    html = html.replace(
        'aria-label="卡数量快捷选项"',
        'data-i18n-aria-label="form.cardCountQuickAria" aria-label="卡数量快捷选项"',
    )
    html = html.replace(
        'title="KV 体积估算不乘专家数；路由激活专家数远小于总数"',
        'data-i18n-title="form.kvcExpertsRoTitle" title="KV 体积估算不乘专家数；路由激活专家数远小于总数"',
    )
    html = html.replace(
        'aria-label="Tokens 快捷选项"',
        'data-i18n-aria-label="form.kvcTokenQuickAria" aria-label="Tokens 快捷选项"',
    )
    html = html.replace(
        'aria-label="推理模式"',
        'data-i18n-aria-label="page.tablistAria" aria-label="推理模式"',
    )

    nav_items = [
        ('nav.inference', 'Agentic推理', 'border-blue-600 pb-1 text-blue-700"'),
        ('nav.postTraining', '后训练', 'border-transparent pb-1 text-slate-600'),
        ('nav.aiDcLayout', 'AI DC布局', 'border-transparent pb-1 text-slate-600'),
        ('nav.whitePaper', '白皮书', 'border-transparent pb-1 text-slate-600'),
        ('nav.aboutUs', 'About US', 'border-transparent pb-1 text-slate-600'),
    ]
    for key, text, cls_part in nav_items:
        html = html.replace(
            f'class="inline-block border-b-2 {cls_part}"\n          >\n            {text}',
            f'class="inline-block border-b-2 {cls_part}"\n            data-i18n="{key}"\n          >\n            {text}',
            1,
        )

    for tab_id, key in [
        ("tab-mixed", "page.tabMixed"),
        ("tab-separated", "page.tabSeparated"),
        ("tab-kvcache", "page.tabKvcache"),
    ]:
        html = html.replace(
            f'id="{tab_id}"\n            role="tab"',
            f'id="{tab_id}"\n            role="tab"\n            data-i18n="{key}"',
        )

    html = re.sub(
        r'(<p class="text-sm text-slate-300">)每张 NPU 估算 HBM(</p>)',
        r'<p class="text-sm text-slate-300" data-i18n="results.hbmPerNpu"></p>',
        html,
        count=1,
    )
    html = re.sub(
        r'(<span class="shrink-0 text-xs font-medium text-slate-400">)占用(</span>)',
        r'<span class="shrink-0 text-xs font-medium text-slate-400" data-i18n="results.used"></span>',
        html,
    )
    html = re.sub(
        r'(<span class="shrink-0 text-xs font-medium text-slate-400">)剩余(</span>)',
        r'<span class="shrink-0 text-xs font-medium text-slate-400" data-i18n="results.remaining"></span>',
        html,
    )

    for key in [
        "results.legendFramework",
        "results.legendModel",
        "results.legendRemain",
        "results.legendOverflow",
    ]:
        pass

    html = re.sub(
        r'(<span class="inline-flex items-center gap-1\.5"><span class="h-2\.5 w-2\.5 rounded-full bg-amber-400"></span>)框架/运行开销(</span>)',
        r'\1<span data-i18n="results.legendFramework"></span>\2',
        html,
    )
    html = re.sub(
        r'(<span class="inline-flex items-center gap-1\.5"><span class="h-2\.5 w-2\.5 rounded-full bg-blue-400"></span>)模型文件占用(</span>)',
        r'\1<span data-i18n="results.legendModel"></span>\2',
        html,
    )
    html = re.sub(
        r'(<span class="inline-flex items-center gap-1\.5"><span class="h-2\.5 w-2\.5 rounded-full bg-emerald-400"></span>)剩余容量(</span>)',
        r'\1<span data-i18n="results.legendRemain"></span>\2',
        html,
    )
    html = re.sub(
        r'(<span class="inline-flex items-center gap-1\.5"><span class="h-2\.5 w-2\.5 rounded-full bg-rose-500"></span>)超出容量(</span>)',
        r'\1<span data-i18n="results.legendOverflow"></span>\2',
        html,
    )

    html = html.replace(
        '<p id="hbmSubtitleSep" class="text-pretty text-sm leading-snug text-slate-300">每张 NPU 估算 HBM（瓶颈侧）</p>',
        '<p id="hbmSubtitleSep" class="text-pretty text-sm leading-snug text-slate-300" data-i18n="results.hbmPerNpuBottleneck"></p>',
    )
    html = html.replace(
        '<option value="32-1p1d" selected>32卡-1P1D</option>',
        '<option value="32-1p1d" selected data-i18n="pd.layout32">32卡-1P1D</option>',
    )
    html = html.replace(
        '<option value="48-1p1d">48卡-1P1D</option>',
        '<option value="48-1p1d" data-i18n="pd.layout48">48卡-1P1D</option>',
    )
    html = re.sub(
        r'(<p class="mt-2 text-xs leading-5 text-slate-500">)\s*每种部署方式下.*?</p>',
        r'<p class="mt-2 text-xs leading-5 text-slate-500" data-i18n-html="form.pdDeployHint"></p>',
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace(
        '<p id="kvcResultSubtitle" class="text-sm text-slate-300">KV Cache 估算体积（dtype_size 随模型量化方式联动）</p>',
        '<p id="kvcResultSubtitle" class="text-sm text-slate-300" data-i18n="results.kvcSubtitleDefault"></p>',
    )

    note_blocks = [
        (
            r'<div class="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 lg:mt-6 xl:col-span-2 xl:mt-0">\s*<strong class="font-semibold">计算说明：</strong>\s*此结果为简化估算.*?</div>',
            r'<div class="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 lg:mt-6 xl:col-span-2 xl:mt-0" data-i18n-html="notes.mixed"></div>',
        ),
        (
            r'(<div class="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 lg:mt-6 xl:col-span-2 xl:mt-0">)\s*<strong class="font-semibold">计算说明（PD分离）：</strong>\s*权重总量.*?</div>',
            r'<div class="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 lg:mt-6 xl:col-span-2 xl:mt-0" data-i18n-html="notes.separated"></div>',
        ),
        (
            r'(<div class="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 lg:mt-6 xl:col-span-2 xl:mt-0">)\s*<strong class="font-semibold">计算说明（KV Cache）：</strong>\s*采用业界.*?</div>',
            r'<div class="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 lg:mt-6 xl:col-span-2 xl:mt-0" data-i18n-html="notes.kvcache"></div>',
        ),
    ]
    html = re.sub(note_blocks[0][0], note_blocks[0][1], html, count=1, flags=re.S)
    html = re.sub(note_blocks[1][0], note_blocks[1][1], html, count=1, flags=re.S)
    html = re.sub(note_blocks[2][0], note_blocks[2][1], html, count=1, flags=re.S)

    html = re.sub(
        r'(<h2 id="capacity-heading" class="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">)\s*容量规划\s*(</h2>)',
        r'<h2 id="capacity-heading" class="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl" data-i18n="capacity.heading"></h2>',
        html,
        count=1,
    )
    html = re.sub(
        r'(<p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg">)\s*结合推理任务.*?</p>',
        r'<p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg" data-i18n-html="capacity.intro"></p>',
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace(
        '<h3 class="text-lg font-semibold text-slate-950">推理集群HBM占用情况</h3>',
        '<h3 class="text-lg font-semibold text-slate-950" data-i18n="capacity.clusterTitle"></h3>',
    )
    html = html.replace(
        '<h3 class="text-lg font-semibold text-slate-950">扩展路径</h3>',
        '<h3 class="text-lg font-semibold text-slate-950" data-i18n="capacity.scaleTitle"></h3>',
    )
    html = re.sub(
        r'(<div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-6">\s*<h3 class="text-lg font-semibold text-slate-950" data-i18n="capacity.clusterTitle"></h3>\s*<p class="mt-2 text-sm leading-6 text-slate-600">)\s*按卡数 × 单卡 HBM 容量汇总.*?(</p>)',
        r'\1 data-i18n="capacity.clusterBody">\2',
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r'(<div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-6">\s*<h3 class="text-lg font-semibold text-slate-950" data-i18n="capacity.scaleTitle"></h3>\s*<p class="mt-2 text-sm leading-6 text-slate-600">)\s*HBM可用显存不足.*?(</p>)',
        r'\1 data-i18n="capacity.scaleBody">\2',
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r'(<div class="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">)\s*<strong.*?</div>',
        r'<div class="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900" data-i18n-html="capacity.hint"></div>',
        html,
        count=1,
        flags=re.S,
    )

    html = re.sub(
        r'(<h2 id="docs-heading" class="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">)\s*说明文档\s*(</h2>)',
        r'<h2 id="docs-heading" class="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl" data-i18n="docs.heading"></h2>',
        html,
        count=1,
    )
    html = re.sub(
        r'(<p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg">)\s*以下为推理页 HBM 估算的规则摘要.*?(</p>)',
        r'<p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg" data-i18n="docs.intro"></p>',
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace(
        '<h3 class="text-lg font-semibold text-slate-950">计算说明</h3>',
        '<h3 class="text-lg font-semibold text-slate-950" data-i18n="docs.calcTitle"></h3>',
        1,
    )
    html = html.replace(
        '<h3 class="text-lg font-semibold text-slate-950">模型占用</h3>',
        '<h3 class="text-lg font-semibold text-slate-950" data-i18n="docs.modelTitle"></h3>',
    )
    html = html.replace(
        '<h3 class="text-lg font-semibold text-slate-950">柱状图含义</h3>',
        '<h3 class="text-lg font-semibold text-slate-950" data-i18n="docs.chartTitle"></h3>',
    )
    html = re.sub(
        r'(<section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-6">\s*<h3 class="text-lg font-semibold text-slate-950" data-i18n="docs.calcTitle"></h3>\s*<p class="mt-3 text-sm leading-7 text-slate-600">)\s*此结果为简化估算.*?(</p>)',
        r'\1 data-i18n-html="docs.calcBody">\2',
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r'(<ul class="mt-3 list-inside list-disc space-y-2 text-sm leading-7 text-slate-600">)\s*<li>部分型号.*?</ul>',
        r'<ul class="mt-3 list-inside list-disc space-y-2 text-sm leading-7 text-slate-600" data-i18n-html="docs.modelList"></ul>',
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r'(<section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-6">\s*<h3 class="text-lg font-semibold text-slate-950" data-i18n="docs.chartTitle"></h3>\s*<p class="mt-3 text-sm leading-7 text-slate-600">)\s*每张 NPU 横向条.*?(</p>)',
        r'\1 data-i18n-html="docs.chartBody">\2',
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r'(<div class="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">)\s*<strong class="font-semibold">使用入口：</strong>\s*回到页面顶部.*?</div>',
        r'<div class="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900" data-i18n-html="docs.entry"></div>',
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace(
        '<span>工信部备案号：',
        '<span data-i18n="footer.miit">工信部备案号：',
    )
    html = html.replace(
        '<span>公安备案号：',
        '<span data-i18n="footer.publicSecurity">公安备案号：',
    )

    html = re.sub(
        r'\n  <script>\n.*?\n  </script>\n\n  <script src="js/lang-switch.js"></script>\n  <script>AidcLangSwitch\.mount\(document\.getElementById\(\'lang-switch-root\'\)\);</script>',
        """
  <script src="js/i18n.js"></script>
  <script src="js/lang-switch.js"></script>
  <script src="js/index-page.js"></script>
  <script>
    (async function bootstrapIndexPage() {
      const params = new URLSearchParams(window.location.search);
      const lang = params.get('lang');
      if (lang === 'zh' || lang === 'en') {
        try {
          localStorage.setItem('aidc-locale', lang);
        } catch (_) {
          /* ignore */
        }
      }
      await AidcI18n.init({ page: 'index', common: true, basePath: 'i18n/' });
      AidcI18n.applyDom();
      window.__aidcI18nAfterLocaleChange = function () {
        if (typeof window.refreshIndexPageI18n === 'function') {
          window.refreshIndexPageI18n();
        }
      };
      AidcLangSwitch.mount(document.getElementById('lang-switch-root'));
      if (typeof window.initIndexPage === 'function') {
        window.initIndexPage();
      }
    })();
  </script>""",
        html,
        count=1,
        flags=re.S,
    )
    return html


def patch_js(js: str) -> str:
    js = "function initIndexPage() {\n  const t = (k, p) => AidcI18n.t(k, p);\n  const loc = () => AidcI18n.localeTag();\n\n" + js

    replacements = [
        ("'未命名模型'", "t('msg.unnamedModel')"),
        ("'未指定 NPU'", "t('msg.unspecifiedNpu')"),
        ("`单卡总容量 ${Number.isFinite(hbmCapacity) ? hbmCapacity : '-'} GB`", "t('msg.perCardCapacity', { value: Number.isFinite(hbmCapacity) ? hbmCapacity : '-' })"),
        ("`${modelName} · ${npuModel} · ${Number.isFinite(cardCount) ? cardCount : '-'} 卡`", "t('msg.resultLabelMixed', { model: modelName, npu: npuModel, cards: Number.isFinite(cardCount) ? cardCount : '-' })"),
        ("'卡数量需为大于等于 1 的整数。'", "t('msg.errCardCount')"),
        ("'单卡 HBM 总容量需为大于 0 的数字。'", "t('msg.errHbmCapacity')"),
        ("'请输入有效模型尺寸，例如 284B、1.6T、72。'", "t('msg.errModelSize')"),
        ("'请选择有效的 PD 部署方式。'", "t('msg.errPdMode')"),
        ("'当前 PD 部署方式的组内卡数无效，请检查配置。'", "t('msg.errPdGroupCards')"),
        ("'未配置该型号的 KV 画像参数。'", "t('msg.kvcNoProfile')"),
        ("'KV Cache 估算体积'", "t('msg.kvcSubtitleSimple')"),
        ("'batch_size 需为大于等于 1 的整数。'", "t('msg.kvcErrBatch')"),
        ("'seq_len 需为大于等于 1 的整数。'", "t('msg.kvcErrSeq')"),
        ("'中间省略'", "t('msg.chartEllipsis')"),
        ("label: '32卡-1P1D'", "labelKey: 'pd.layout32'"),
        ("label: '48卡-1P1D'", "labelKey: 'pd.layout48'"),
        ("layout.label", "t(layout.labelKey)"),
        ("seqLen.toLocaleString('zh-CN')", "seqLen.toLocaleString(loc())"),
        (".toLocaleString('zh-CN')", ".toLocaleString(loc())"),
        ("'（W8A8）'", "t('msg.weightNoteW8A8')"),
        ("'（W4A8）'", "t('msg.weightNoteW4A8')"),
        ("bottleneckSide = bottleneckIsPrefill ? 'Prefill' : 'Decode'", "bottleneckSide = bottleneckIsPrefill ? t('msg.sidePrefill') : t('msg.sideDecode')"),
        ("label: 'INT8（W8A8）'", "label: t('msg.quantW8A8Label')"),
        ("note: 'W8A8 部署常见 INT8 KV（1 byte/element，约为 FP16 一半）'", "note: t('msg.quantW8A8Note')"),
        ("label: 'INT8（W4A8 · A8）'", "label: t('msg.quantW4A8Label')"),
        ("note: 'W4 仅影响权重；KV Cache 随激活 A8 按 INT8（1 byte/element）估算'", "note: t('msg.quantW4A8Note')"),
        ("label: 'INT4'", "label: t('msg.quantInt4Label')"),
        ("note: 'INT4 KV（0.5 byte/element）'", "note: t('msg.quantInt4Note')"),
        ("label: 'FP8'", "label: t('msg.quantFp8Label')"),
        ("note: 'FP8 KV（1 byte/element）'", "note: t('msg.quantFp8Note')"),
        ("label: 'BF16/FP16'", "label: t('msg.quantBf16Label')"),
        ("note: 'BF16/FP16 KV（2 bytes/element）'", "note: t('msg.quantBf16Note')"),
        ("label: 'BF16/FP16（默认）'", "label: t('msg.quantDefaultLabel')"),
        ("note: '未识别量化后缀，按 BF16/FP16 KV（2 bytes/element）估算'", "note: t('msg.quantDefaultNote')"),
        (
            "note: 'CSA/HCA 序列压缩；BF16 @ 1M 约 9.62 GiB，W8A8 KV 减半约 4.81 GiB',",
            "noteKey: 'v4FlashNote',",
        ),
        (
            "note: '同 V4 压缩族；BF16 锚点按 Flash × (L×H_kv)_Pro / (L×H_kv)_Flash 外推',",
            "noteKey: 'v4ProNote',",
        ),
    ]
    for old, new in replacements:
        js = js.replace(old, new)

    js = js.replace(
        """        detailLine = `模型权重合计 ${fixedWeightGb} GB${weightNote} / ${cardCount} = ${modelUsage.toFixed(2)} GB/卡，框架/运行开销 ${frameworkUsage.toFixed(2)} GB（单卡容量 10%），剩余 ${remaining.toFixed(2)} GB/卡${overflow > 0 ? `，超出 ${overflow.toFixed(2)} GB/卡` : ''}。`;""",
        """        detailLine = t('msg.mixedDetailFixed', {
          weight: fixedWeightGb,
          note: weightNote,
          cards: cardCount,
          usage: modelUsage.toFixed(2),
          framework: frameworkUsage.toFixed(2),
          remaining: remaining.toFixed(2),
          overflow: overflow > 0 ? t('msg.mixedDetailFixedOverflow', { overflow: overflow.toFixed(2) }) : '',
        });""",
    )
    js = js.replace(
        """        detailLine = `${displayParam} × 2 bytes / ${cardCount} = ${modelUsage.toFixed(2)} GB 模型文件，框架/运行开销 ${frameworkUsage.toFixed(2)} GB（单卡容量 10%），剩余 ${remaining.toFixed(2)} GB/卡${overflow > 0 ? `，超出 ${overflow.toFixed(2)} GB/卡` : ''}。`;""",
        """        detailLine = t('msg.mixedDetailParam', {
          param: displayParam,
          cards: cardCount,
          usage: modelUsage.toFixed(2),
          framework: frameworkUsage.toFixed(2),
          remaining: remaining.toFixed(2),
          overflow: overflow > 0 ? t('msg.mixedDetailFixedOverflow', { overflow: overflow.toFixed(2) }) : '',
        });""",
    )
    js = js.replace(
        "resultLabelSep.textContent = `${modelName} · ${npuModel} · ${t(layout.labelKey)}`;",
        "resultLabelSep.textContent = t('msg.resultLabelSep', { model: modelName, npu: npuModel, layout: t(layout.labelKey) });",
    )
    js = js.replace(
        "resultLabelSep.textContent = `${modelName} · ${npuModel} · ${t(layout.labelKey)} · 瓶颈：${bottleneckSide}`;",
        "resultLabelSep.textContent = t('msg.resultLabelSepBottleneck', { model: modelName, npu: npuModel, layout: t(layout.labelKey), side: bottleneckSide });",
    )
    js = js.replace(
        "hbmSubtitleSep.textContent = `每张 NPU 估算 HBM（${bottleneckSide}，瓶颈侧）`;",
        "hbmSubtitleSep.textContent = t('msg.hbmSubtitleBottleneck', { side: bottleneckSide });",
    )
    js = js.replace(
        """      const lineP = `Prefill：${layout.pCardTotal} 卡 / ${layout.pGroups} 组 → 每组 ${cardsPerPGroup} 卡（组内均摊一整份权重），每卡占用 ${usageP.toFixed(2)} GB，剩余 ${signedRemainP.toFixed(2)} GB。`;""",
        """      const lineP = t('msg.linePrefill', {
        total: layout.pCardTotal,
        groups: layout.pGroups,
        perGroup: cardsPerPGroup,
        usage: usageP.toFixed(2),
        remain: signedRemainP.toFixed(2),
      });""",
    )
    js = js.replace(
        """      const lineD = `Decode：${layout.dCardTotal} 卡 / ${layout.dGroups} 组 → 每组 ${cardsPerDGroup} 卡（组内均摊一整份权重），每卡占用 ${usageD.toFixed(2)} GB，剩余 ${signedRemainD.toFixed(2)} GB。`;""",
        """      const lineD = t('msg.lineDecode', {
        total: layout.dCardTotal,
        groups: layout.dGroups,
        perGroup: cardsPerDGroup,
        usage: usageD.toFixed(2),
        remain: signedRemainD.toFixed(2),
      });""",
    )
    js = js.replace(
        """      const lineB = `瓶颈侧为 ${bottleneckSide}（单卡总占用更高）。柱状图按 Prefill / Decode 分组列出各组 NPU；每组多于 5 卡时显示前 4 条与末卡，中间省略。`;""",
        "      const lineB = t('msg.lineBottleneck', { side: bottleneckSide });",
    )
    js = js.replace(
        "const barTitle = `框架 ${frameworkUsage.toFixed(2)} GB，模型 ${modelUsage.toFixed(2)} GB，剩余 ${remaining.toFixed(2)} GB`;",
        "const barTitle = t('msg.barTitle', { framework: frameworkUsage.toFixed(2), model: modelUsage.toFixed(2), remaining: remaining.toFixed(2) });",
    )
    js = js.replace(
        'title="本组中间 ${cardCount - 5} 张卡与首尾占用相同"',
        'title="${t(\'msg.chartEllipsisTitle\', { count: cardCount - 5 })}"',
    )
    js = js.replace(
        """            <p class="text-xs font-semibold text-slate-300">Prefill · 组 ${g} · ${cardsPerPGroup} 卡</p>""",
        """            <p class="text-xs font-semibold text-slate-300">${t('msg.chartGroupPrefill', { group: g, cards: cardsPerPGroup })}</p>""",
    )
    js = js.replace(
        """            <p class="text-xs font-semibold text-slate-300">Decode · 组 ${g} · ${cardsPerDGroup} 卡</p>""",
        """            <p class="text-xs font-semibold text-slate-300">${t('msg.chartGroupDecode', { group: g, cards: cardsPerDGroup })}</p>""",
    )
    js = js.replace(
        "kvcResultSubtitle.textContent = `KV Cache 估算体积（${quant.label}，${quant.dtypeBytes} byte/element）`;",
        "kvcResultSubtitle.textContent = t('msg.kvcSubtitleQuant', { label: quant.label, dtype: quant.dtypeBytes });",
    )
    js = js.replace(
        "kvcResultMiB.textContent = `（≈ ${mib.toLocaleString(loc(), { maximumFractionDigits: 2 })} MiB）`;",
        "kvcResultMiB.textContent = t('msg.kvcMiB', { mib: mib.toLocaleString(loc(), { maximumFractionDigits: 2 }) });",
    )
    js = js.replace(
        "kvcResultSubtitle.textContent = `KV Cache 估算（GLM MLA + DSA · ${quant.label}）`;",
        "kvcResultSubtitle.textContent = t('msg.kvcSubtitleMlaDsa', { label: quant.label });",
    )
    js = js.replace(
        "kvcResultSubtitle.textContent = `KV Cache 估算（DeepSeek MLA · ${quant.label}）`;",
        "kvcResultSubtitle.textContent = t('msg.kvcSubtitleMla', { label: quant.label });",
    )
    js = js.replace(
        "kvcResultSubtitle.textContent = `KV Cache 估算（Qwen 混合注意力 · ${quant.label}）`;",
        "kvcResultSubtitle.textContent = t('msg.kvcSubtitleQwen', { label: quant.label });",
    )
    js = js.replace(
        "kvcResultSubtitle.textContent = `KV Cache 估算（V4 CSA/HCA 压缩 · ${quant.label}）`;",
        "kvcResultSubtitle.textContent = t('msg.kvcSubtitleV4', { label: quant.label });",
    )
    js = js.replace(
        "kvcLayersRo.value = `${prof.fullAttentionLayers}（full）+ ${prof.linearAttentionLayers}（linear）`;",
        "kvcLayersRo.value = t('msg.kvcLayersHybrid', { full: prof.fullAttentionLayers, linear: prof.linearAttentionLayers });",
    )
    js = js.replace(
        "resultMessageSep.textContent = '选择 PD 部署方式后，将按 P/D 分组展示每卡占用与瓶颈侧柱状图。';",
        "resultMessageSep.textContent = t('results.sepPlaceholder');",
    )
    js = js.replace(
        "hbmSubtitleSep.textContent = '每张 NPU 估算 HBM（瓶颈侧）';",
        "hbmSubtitleSep.textContent = t('results.hbmPerNpuBottleneck');",
    )

    js = js.replace(
        """        kvcResultFormula.textContent =
          `MLA+DSA 展开：L ${prof.layers} × seq_len ${seqLabel} × batch_size ${batchSize} × [(${prof.compressedKvDim} + ${prof.ropeHeadDim} + ${prof.dsaIndexHeadDim}) × dtype_size ${dtypeBytes} + indexer_scale ${prof.dsaIndexScaleBytes}] = ${perLayerPerTokenBytes} bytes/token/layer ≈ ${bytes.toLocaleString(loc())} bytes（≈ ${gib.toFixed(4)} GiB）。` +
          ` 全模型每 token ${bytesPerToken.toLocaleString(loc())} bytes（≈ ${(bytesPerToken / 1024).toFixed(1)} KiB）。` +
          ` 仅 MLA 口径 ≈ ${mlaOnlyGib.toFixed(2)} GiB；对比标准 GQA 展开式 ≈ ${standardGib.toFixed(2)} GiB。${quant.note}。MoE 专家数 ${prof.experts != null ? prof.experts : '—'} 未乘入 KV。`;""",
        """        kvcResultFormula.textContent = t('msg.kvcFormulaMlaDsa', {
          layers: prof.layers,
          seqLabel,
          batchSize,
          compressedKvDim: prof.compressedKvDim,
          ropeHeadDim: prof.ropeHeadDim,
          dsaIndexHeadDim: prof.dsaIndexHeadDim,
          dtypeBytes,
          indexerScale: prof.dsaIndexScaleBytes,
          perLayerPerTokenBytes,
          bytes: bytes.toLocaleString(loc()),
          gib: gib.toFixed(4),
          bytesPerToken: bytesPerToken.toLocaleString(loc()),
          kibPerToken: (bytesPerToken / 1024).toFixed(1),
          mlaOnlyGib: mlaOnlyGib.toFixed(2),
          standardGib: standardGib.toFixed(2),
          quantNote: quant.note,
          experts: prof.experts != null ? prof.experts : '—',
        });""",
    )

    js = js.replace(
        """        kvcResultFormula.textContent =
          `MLA 展开：L ${prof.layers} × (kv_lora_rank ${prof.compressedKvDim} + qk_rope_head_dim ${prof.ropeHeadDim}) × seq_len ${seqLabel} × batch_size ${batchSize} × dtype_size ${dtypeBytes}（${quant.label}）≈ ${bytes.toLocaleString(loc())} bytes（≈ ${gib.toFixed(4)} GiB）。` +
          ` 每层每 token ${perLayerPerToken} 元素，全模型每 token ${bytesPerToken.toLocaleString(loc())} bytes（≈ ${(bytesPerToken / 1024).toFixed(1)} KiB）。` +
          ` 对比标准 GQA 展开式 ≈ ${standardGib.toFixed(2)} GiB。${quant.note}。MoE 专家数 ${prof.experts != null ? prof.experts : '—'} 未乘入 MLA KV。`;""",
        """        kvcResultFormula.textContent = t('msg.kvcFormulaMla', {
          layers: prof.layers,
          compressedKvDim: prof.compressedKvDim,
          ropeHeadDim: prof.ropeHeadDim,
          seqLabel,
          batchSize,
          dtypeBytes,
          quantLabel: quant.label,
          bytes: bytes.toLocaleString(loc()),
          gib: gib.toFixed(4),
          perLayerPerToken,
          bytesPerToken: bytesPerToken.toLocaleString(loc()),
          kibPerToken: (bytesPerToken / 1024).toFixed(1),
          standardGib: standardGib.toFixed(2),
          quantNote: quant.note,
          experts: prof.experts != null ? prof.experts : '—',
        });""",
    )

    js = js.replace(
        """        kvcResultFormula.textContent =
          `混合注意力：L_full ${prof.fullAttentionLayers} × 2(K/V) × H_kv ${prof.kvHeads} × head_dim ${prof.headDim} × seq_len ${seqLabel} × batch_size ${batchSize} × dtype_size ${dtypeBytes}（${quant.label}）≈ ${bytes.toLocaleString(loc())} bytes（≈ ${gib.toFixed(4)} GiB）。` +
          ` 每层每 token ${bytesPerLayer.toLocaleString(loc())} bytes，全模型每 token ${bytesPerToken.toLocaleString(loc())} bytes（${prof.linearAttentionLayers} 层 linear attention 未计入）。` +
          ` 对比若 ${totalLayers} 层均为 full attention GQA ≈ ${naiveFullGqaGib.toFixed(2)} GiB。${quant.note}。MoE 专家数 ${prof.experts != null ? prof.experts : '—'} 未计入。`;""",
        """        kvcResultFormula.textContent = t('msg.kvcFormulaQwen', {
          fullLayers: prof.fullAttentionLayers,
          kvHeads: prof.kvHeads,
          headDim: prof.headDim,
          seqLabel,
          batchSize,
          dtypeBytes,
          quantLabel: quant.label,
          bytes: bytes.toLocaleString(loc()),
          gib: gib.toFixed(4),
          bytesPerLayer: bytesPerLayer.toLocaleString(loc()),
          bytesPerToken: bytesPerToken.toLocaleString(loc()),
          linearLayers: prof.linearAttentionLayers,
          totalLayers,
          naiveFullGqaGib: naiveFullGqaGib.toFixed(2),
          quantNote: quant.note,
          experts: prof.experts != null ? prof.experts : '—',
        });""",
    )

    js = js.replace(
        """        kvcResultFormula.textContent =
          `V4 压缩估算：BF16 基准 ${anchor.bf16AnchorGiB.toFixed(2)} GiB @ seq_len ${anchor.anchorSeqLen.toLocaleString(loc())} × (dtype_size ${dtypeBytes} / 2) ≈ ${anchorKvGiB.toFixed(2)} GiB @ 1M × (seq_len ${seqLabel} / ${anchor.anchorSeqLen.toLocaleString(loc())}) × batch_size ${batchSize} ≈ ${bytes.toLocaleString(loc())} bytes（≈ ${gib.toFixed(4)} GiB）。` +
          ` 对比标准 GQA 展开式 ≈ ${standardGib.toFixed(2)} GiB。${anchor.note}。MoE 专家数 ${prof.experts != null ? prof.experts : '—'} 未计入；每 token 约 ${Math.round(bytesPerToken).toLocaleString(loc())} bytes（含架构压缩）。`;""",
        """        kvcResultFormula.textContent = t('msg.kvcFormulaV4', {
          bf16AnchorGiB: anchor.bf16AnchorGiB.toFixed(2),
          anchorSeqLen: anchor.anchorSeqLen.toLocaleString(loc()),
          dtypeBytes,
          anchorKvGiB: anchorKvGiB.toFixed(2),
          seqLabel,
          batchSize,
          bytes: bytes.toLocaleString(loc()),
          gib: gib.toFixed(4),
          standardGib: standardGib.toFixed(2),
          anchorNote: t('msg.' + anchor.noteKey),
          experts: prof.experts != null ? prof.experts : '—',
          bytesPerToken: Math.round(bytesPerToken).toLocaleString(loc()),
        });""",
    )

    js = js.replace(
        """      kvcResultFormula.textContent =
        `展开：2(K/V) × L ${prof.layers} × num_key_value_heads ${prof.kvHeads} × head_dim ${prof.headDim} × seq_len ${seqLabel} × batch_size ${batchSize} × dtype_size ${dtypeBytes}（${quant.label}）≈ ${bytes.toLocaleString(loc())} bytes。` +
        `每 token 约 ${Math.round(bytesPerToken).toLocaleString(loc())} bytes（不含 batch）。${quant.note}。MoE 专家数 ${prof.experts != null ? prof.experts : '—'} 未计入。`;""",
        """      kvcResultFormula.textContent = t('msg.kvcFormulaStandard', {
        layers: prof.layers,
        kvHeads: prof.kvHeads,
        headDim: prof.headDim,
        seqLabel,
        batchSize,
        dtypeBytes,
        quantLabel: quant.label,
        bytes: bytes.toLocaleString(loc()),
        bytesPerToken: Math.round(bytesPerToken).toLocaleString(loc()),
        quantNote: quant.note,
        experts: prof.experts != null ? prof.experts : '—',
      });""",
    )

    js = js.rstrip() + """

  window.refreshIndexPageI18n = function refreshIndexPageI18n() {
    document.querySelectorAll('#pdDeployMode option').forEach((opt) => {
      const key = opt.value === '32-1p1d' ? 'pd.layout32' : opt.value === '48-1p1d' ? 'pd.layout48' : null;
      if (key) opt.textContent = t(key);
    });
    const mode =
      tabKvcache.getAttribute('aria-selected') === 'true'
        ? 'kvcache'
        : tabSeparated.getAttribute('aria-selected') === 'true'
          ? 'separated'
          : 'mixed';
    selectDeploymentTab(mode);
  };
}
window.initIndexPage = initIndexPage;
"""
    return js


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    m = re.search(
        r"\n  <script>\n(.*?)\n  </script>\n\n  <script src=\"js/lang-switch.js\">",
        html,
        re.S,
    )
    if not m:
        raise SystemExit("Could not find inline script block")
    js_body = m.group(1)
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.write_text(patch_js(js_body), encoding="utf-8")
    INDEX.write_text(patch_html(html), encoding="utf-8")
    print(f"Wrote {OUT_JS} and patched {INDEX}")


if __name__ == "__main__":
    main()
