function initIndexPage() {
  const t = (k, p) => AidcI18n.t(k, p);
  const loc = () => AidcI18n.localeTag();

    const tabPrinciples = document.getElementById('tab-principles');
    const tabDataflow = document.getElementById('tab-dataflow');
    const tabMixed = document.getElementById('tab-mixed');
    const tabSeparated = document.getElementById('tab-separated');
    const tabKvcache = document.getElementById('tab-kvcache');
    const panelPrinciples = document.getElementById('panel-principles');
    const panelDataflow = document.getElementById('panel-dataflow');
    const panelMixed = document.getElementById('panel-mixed');
    const panelSeparated = document.getElementById('panel-separated');
    const panelKvcache = document.getElementById('panel-kvcache');
    const iframePrinciples = document.getElementById('iframe-principles');
    const iframeDataflow = document.getElementById('iframe-dataflow');

    const modelNameInput = document.getElementById('modelName');
    const modelSizeInput = document.getElementById('modelSize');
    const npuModelInput = document.getElementById('npuModel');
    const cardCountInput = document.getElementById('cardCount');
    const hbmCapacityInput = document.getElementById('hbmCapacity');
    const hbmUsed = document.getElementById('hbmUsed');
    const hbmRemain = document.getElementById('hbmRemain');
    const resultLabel = document.getElementById('resultLabel');
    const capacityLabel = document.getElementById('capacityLabel');
    const resultMessage = document.getElementById('resultMessage');
    const hbmChart = document.getElementById('hbmChart');

    const modelNameSep = document.getElementById('modelNameSep');
    const modelSizeSep = document.getElementById('modelSizeSep');
    const npuModelSep = document.getElementById('npuModelSep');
    const pdDeployMode = document.getElementById('pdDeployMode');
    const hbmCapacitySep = document.getElementById('hbmCapacitySep');
    const hbmSubtitleSep = document.getElementById('hbmSubtitleSep');
    const hbmUsedSep = document.getElementById('hbmUsedSep');
    const hbmRemainSep = document.getElementById('hbmRemainSep');
    const resultLabelSep = document.getElementById('resultLabelSep');
    const capacityLabelSep = document.getElementById('capacityLabelSep');
    const resultMessageSep = document.getElementById('resultMessageSep');
    const hbmChartSep = document.getElementById('hbmChartSep');

    const modelNameKvc = document.getElementById('modelNameKvc');
    const kvcTokenCount = document.getElementById('kvcTokenCount');
    const kvcBatchSize = document.getElementById('kvcBatchSize');
    const kvcModelSizeRo = document.getElementById('kvcModelSizeRo');
    const kvcLayersRo = document.getElementById('kvcLayersRo');
    const kvcExpertsRo = document.getElementById('kvcExpertsRo');
    const kvcKvHeadsRo = document.getElementById('kvcKvHeadsRo');
    const kvcHeadDimRo = document.getElementById('kvcHeadDimRo');
    const kvcQuantRo = document.getElementById('kvcQuantRo');
    const kvcDtypeSizeRo = document.getElementById('kvcDtypeSizeRo');
    const kvcResultSubtitle = document.getElementById('kvcResultSubtitle');
    const kvcResultGb = document.getElementById('kvcResultGb');
    const kvcResultMiB = document.getElementById('kvcResultMiB');
    const kvcResultFormula = document.getElementById('kvcResultFormula');

    const TAB_ACTIVE_CLASS =
      'rounded-xl px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition bg-white';
    const TAB_INACTIVE_CLASS =
      'rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white/80 hover:text-slate-950';

    const FRAMEWORK_OVERHEAD_OF_CAPACITY = 0.1;

    const fixedW8A8WeightGbByModel = {
      'DeepSeek-R1-W8A8': 689,
      'DeepSeek-V3.1-Terminus-W4A8': 360,
      'DeepSeek-V4-Flash-W8A8': 160,
      'DeepSeek-V4-Pro-W8A8': 865,
      'GLM-5.1-W8A8': 756,
      'Qwen3.6-35B-A3B': 71.9,
    };

    const modelSizeMap = {
      'DeepSeek-R1-W8A8': '685B',
      'DeepSeek-V3.1-Terminus-W4A8': '685B',
      'DeepSeek-V4-Flash-W8A8': '284B',
      'DeepSeek-V4-Pro-W8A8': '1.6T',
      'Qwen3.6-35B-A3B': '35B',
      'GLM-5.1-W8A8': '744B',
    };

    const npuCapacityMap = {
      'Ascend A2': 64,
      'Ascend A3': 128,
      'Ascend 950DT': 96,
    };

    /** Prefill / Decode 各占一半总卡数；每组独立部署一整份 modelGb，组内均摊。 */
    const pdDeployLayouts = {
      '32-1p1d': {
        labelKey: 'pd.layout32',
        totalCards: 32,
        pCardTotal: 16,
        pGroups: 1,
        dCardTotal: 16,
        dGroups: 1,
      },
      '48-1p1d': {
        labelKey: 'pd.layout48',
        totalCards: 48,
        pCardTotal: 24,
        pGroups: 1,
        dCardTotal: 24,
        dGroups: 1,
      },
    };

    /**
     * KV Cache 估算用模型画像（与混部下拉型号对齐）。
     * 标准公式（tutorialQ / vLLM 等）：
     * KV_bytes = 2 × L × H_kv × head_dim × seq_len × batch_size × dtype_size
     * DeepSeek R1 / V3.1 使用 MLA 结构化公式（kv_lora_rank + qk_rope_head_dim，非标准 GQA）。
     * GLM-5.1 使用 MLA + DSA（含 indexer key 与 FP32 scale）。
     * Qwen3.6 混合注意力：仅 full attention 层保存完整 KV（linear 层不计入）。
     * DeepSeek V4 另见 v4KvCompressedAnchors（CSA/HCA 架构压缩）。
     */
    const kvModelProfiles = {
      'DeepSeek-R1-W8A8': {
        layers: 61,
        compressedKvDim: 512,
        ropeHeadDim: 64,
        experts: 256,
        kvHeads: 128,
        headDim: 128,
        kvFormula: 'mla',
      },
      'DeepSeek-V3.1-Terminus-W4A8': {
        layers: 61,
        compressedKvDim: 512,
        ropeHeadDim: 64,
        experts: 256,
        kvHeads: 128,
        headDim: 128,
        kvFormula: 'mla',
      },
      'DeepSeek-V4-Flash-W8A8': { layers: 43, experts: 128, kvHeads: 96, headDim: 128, kvFormula: 'v4-compressed' },
      'DeepSeek-V4-Pro-W8A8': { layers: 61, experts: 256, kvHeads: 128, headDim: 128, kvFormula: 'v4-compressed' },
      'Qwen3.6-35B-A3B': {
        layers: 40,
        fullAttentionLayers: 10,
        linearAttentionLayers: 30,
        kvHeads: 2,
        headDim: 256,
        experts: 128,
        kvFormula: 'qwen-hybrid-attention',
        kvQuant: {
          labelKey: 'quantFp16Label',
          dtypeBytes: 2,
          noteKey: 'quantFp16Note',
        },
      },
      'GLM-5.1-W8A8': {
        layers: 78,
        compressedKvDim: 512,
        ropeHeadDim: 64,
        dsaIndexHeadDim: 128,
        dsaIndexScaleBytes: 4,
        experts: 384,
        kvHeads: 96,
        headDim: 128,
        kvFormula: 'mla-dsa',
      },
    };

    /**
     * DeepSeek V4：混合注意力 CSA/HCA 在序列长度上压缩 KV，非 V3 MLA 逐层低秩方案。
     * BF16 锚点：V4-Flash @ seq_len=1M、batch=1 ≈ 9.62 GiB；W8A8（FP8 KV，1 byte）≈ 9.62 ÷ 2 = 4.81 GiB。
     * Pro 的 bf16AnchorGiB 按 Flash × (L×H_kv)_Pro / (L×H_kv)_Flash 外推，待官方实测校准。
     */
    const v4KvCompressedAnchors = {
      'DeepSeek-V4-Flash-W8A8': {
        anchorSeqLen: 1_000_000,
        bf16AnchorGiB: 9.62,
        noteKey: 'v4FlashNote',
      },
      'DeepSeek-V4-Pro-W8A8': {
        anchorSeqLen: 1_000_000,
        bf16AnchorGiB: 9.62 * ((61 * 128) / (43 * 96)),
        noteKey: 'v4ProNote',
      },
    };

    /** 从模型名称解析 KV Cache 存储精度；推理框架中 kv_cache_dtype 可单独配置，此处按名称后缀缺省推断。 */
    function parseKvQuantFromModelName(modelName) {
      const tag = modelName.trim().toUpperCase();

      if (/W8A8/.test(tag)) {
        return {
          label: t('msg.quantW8A8Label'),
          dtypeBytes: 1,
          note: t('msg.quantW8A8Note'),
        };
      }

      if (/W4A8/.test(tag)) {
        return {
          label: t('msg.quantW4A8Label'),
          dtypeBytes: 1,
          note: t('msg.quantW4A8Note'),
        };
      }

      if (/W\d+A4|INT4|W4A4/.test(tag)) {
        return {
          label: t('msg.quantInt4Label'),
          dtypeBytes: 0.5,
          note: t('msg.quantInt4Note'),
        };
      }

      if (/FP8|W8A16/.test(tag)) {
        return {
          label: t('msg.quantFp8Label'),
          dtypeBytes: 1,
          note: t('msg.quantFp8Note'),
        };
      }

      if (/W\d+A16|BF16|FP16/.test(tag)) {
        return {
          label: t('msg.quantBf16Label'),
          dtypeBytes: 2,
          note: t('msg.quantBf16Note'),
        };
      }

      return {
        label: t('msg.quantDefaultLabel'),
        dtypeBytes: 2,
        note: t('msg.quantDefaultNote'),
      };
    }

    function resolveKvQuant(modelKey, profile) {
      if (profile?.kvQuant) {
        const q = profile.kvQuant;
        return {
          label: q.labelKey ? t(q.labelKey) : q.label,
          dtypeBytes: q.dtypeBytes,
          note: q.noteKey ? t(q.noteKey) : q.note,
        };
      }

      return parseKvQuantFromModelName(modelKey);
    }

    function computeStandardKvCacheBytes(profile, quant, seqLen, batchSize) {
      return (
        2 *
        profile.layers *
        profile.kvHeads *
        profile.headDim *
        seqLen *
        batchSize *
        quant.dtypeBytes
      );
    }

    function computeMlaKvCacheBytes(profile, quant, seqLen, batchSize) {
      const perLayerPerToken = profile.compressedKvDim + profile.ropeHeadDim;
      return profile.layers * perLayerPerToken * seqLen * batchSize * quant.dtypeBytes;
    }

    function computeMlaDsaKvCacheBytes(profile, quant, seqLen, batchSize) {
      const mlaElements = profile.compressedKvDim + profile.ropeHeadDim;
      const dsaIndexElements = profile.dsaIndexHeadDim;
      const scaleBytes = profile.dsaIndexScaleBytes || 0;
      const perLayerPerTokenBytes =
        (mlaElements + dsaIndexElements) * quant.dtypeBytes + scaleBytes;
      return profile.layers * perLayerPerTokenBytes * seqLen * batchSize;
    }

    function computeQwenHybridKvCacheBytes(profile, quant, seqLen, batchSize) {
      const elementsPerLayer = 2 * profile.kvHeads * profile.headDim;
      const bytesPerToken = elementsPerLayer * quant.dtypeBytes * profile.fullAttentionLayers;
      return bytesPerToken * seqLen * batchSize;
    }

    function computeV4CompressedKvBytes(modelKey, quant, seqLen, batchSize) {
      const anchor = v4KvCompressedAnchors[modelKey];
      const bf16AnchorBytes = anchor.bf16AnchorGiB * 1024 ** 3;
      const anchorKvBytes = bf16AnchorBytes * (quant.dtypeBytes / 2);
      return (anchorKvBytes * seqLen * batchSize) / anchor.anchorSeqLen;
    }

    function computeKvCacheBytes(modelKey, profile, quant, seqLen, batchSize) {
      if (profile.kvFormula === 'mla-dsa') {
        return computeMlaDsaKvCacheBytes(profile, quant, seqLen, batchSize);
      }

      if (profile.kvFormula === 'mla') {
        return computeMlaKvCacheBytes(profile, quant, seqLen, batchSize);
      }

      if (profile.kvFormula === 'qwen-hybrid-attention') {
        return computeQwenHybridKvCacheBytes(profile, quant, seqLen, batchSize);
      }

      if (profile.kvFormula === 'v4-compressed' && v4KvCompressedAnchors[modelKey]) {
        return computeV4CompressedKvBytes(modelKey, quant, seqLen, batchSize);
      }

      return computeStandardKvCacheBytes(profile, quant, seqLen, batchSize);
    }

    function syncNpuCapacityFromSelection() {
      const model = npuModelInput.value;
      const mapped = npuCapacityMap[model];

      if (typeof mapped === 'number') {
        hbmCapacityInput.value = String(mapped);
      }
    }

    function syncNpuCapacitySepFromSelection() {
      const model = npuModelSep.value;
      const mapped = npuCapacityMap[model];

      if (typeof mapped === 'number') {
        hbmCapacitySep.value = String(mapped);
      }
    }

    function attachSyncedInputs(inputs, fn) {
      inputs.forEach((input) => {
        input.addEventListener('input', fn);
        input.addEventListener('change', fn);
      });
    }

    function parseModelSize(value) {
      const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
      const match = normalized.match(/^(\d+(?:\.\d+)?)(T|B|亿)?$/);

      if (!match) {
        return NaN;
      }

      const amount = Number(match[1]);
      const unit = match[2] || 'B';

      if (unit === '亿') {
        return amount / 10;
      }

      if (unit === 'T') {
        return amount * 1000;
      }

      return amount;
    }

    function formatModelParamBillions(modelSizeB) {
      if (!Number.isFinite(modelSizeB) || modelSizeB <= 0) {
        return '';
      }

      if (modelSizeB >= 1000) {
        const t = modelSizeB / 1000;
        const rounded = Math.round(t * 100) / 100;
        const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
        return `${text}T`;
      }

      if (Number.isInteger(modelSizeB)) {
        return `${modelSizeB}B`;
      }

      return `${modelSizeB.toFixed(2)}B`;
    }

    function setHbmHeadline(usedEl, remainEl, usedText, remainText, remainTone) {
      usedEl.textContent = usedText;
      remainEl.textContent = remainText;
      const base = 'text-3xl font-bold tracking-tight tabular-nums sm:text-4xl';
      if (remainTone === 'good') {
        remainEl.className = `${base} text-emerald-300`;
      } else if (remainTone === 'bad') {
        remainEl.className = `${base} text-rose-300`;
      } else {
        remainEl.className = `${base} text-slate-300`;
      }
    }

    function clearSepOutputs() {
      setHbmHeadline(hbmUsedSep, hbmRemainSep, '--', '--', 'neutral');
      hbmChartSep.innerHTML = '';
    }

    function syncKvProfileFromModel() {
      const key = modelNameKvc.value;
      const prof = kvModelProfiles[key];
      const quant = prof ? resolveKvQuant(key, prof) : parseKvQuantFromModelName(key);
      kvcModelSizeRo.value = modelSizeMap[key] || '';
      kvcQuantRo.value = quant.label;
      kvcDtypeSizeRo.value = String(quant.dtypeBytes);

      if (!prof) {
        kvcLayersRo.value = '';
        kvcExpertsRo.value = '';
        kvcKvHeadsRo.value = '';
        kvcHeadDimRo.value = '';
        return;
      }

      kvcLayersRo.value = String(prof.layers);
      kvcExpertsRo.value = prof.experts != null ? String(prof.experts) : '—';
      if (prof.kvFormula === 'mla-dsa') {
        kvcKvHeadsRo.value = `${prof.compressedKvDim} (kv_lora_rank)`;
        kvcHeadDimRo.value = `${prof.ropeHeadDim} (qk_rope) + ${prof.dsaIndexHeadDim} (DSA index)`;
        return;
      }

      if (prof.kvFormula === 'qwen-hybrid-attention') {
        kvcLayersRo.value = t('msg.kvcLayersHybrid', { full: prof.fullAttentionLayers, linear: prof.linearAttentionLayers });
        kvcKvHeadsRo.value = String(prof.kvHeads);
        kvcHeadDimRo.value = String(prof.headDim);
        return;
      }

      if (prof.kvFormula === 'mla') {
        kvcKvHeadsRo.value = `${prof.compressedKvDim} (kv_lora_rank)`;
        kvcHeadDimRo.value = `${prof.ropeHeadDim} (qk_rope_head_dim)`;
        return;
      }

      kvcKvHeadsRo.value = String(prof.kvHeads);
      kvcHeadDimRo.value = String(prof.headDim);
    }

    function updateKvCacheEstimate() {
      const key = modelNameKvc.value;
      const prof = kvModelProfiles[key];
      const quant = prof ? resolveKvQuant(key, prof) : parseKvQuantFromModelName(key);
      const seqLen = Number(kvcTokenCount.value);
      const batchSize = Number(kvcBatchSize.value);

      if (!prof) {
        kvcResultGb.textContent = '--';
        kvcResultMiB.textContent = '';
        kvcResultFormula.textContent = t('msg.kvcNoProfile');
        kvcResultSubtitle.textContent = t('msg.kvcSubtitleSimple');
        return;
      }

      kvcQuantRo.value = quant.label;
      kvcDtypeSizeRo.value = String(quant.dtypeBytes);
      kvcResultSubtitle.textContent = t('msg.kvcSubtitleQuant', { label: quant.label, dtype: quant.dtypeBytes });

      if (!Number.isInteger(batchSize) || batchSize < 1) {
        kvcResultGb.textContent = '--';
        kvcResultMiB.textContent = '';
        kvcResultFormula.textContent = t('msg.kvcErrBatch');
        return;
      }

      if (!Number.isInteger(seqLen) || seqLen < 1) {
        kvcResultGb.textContent = '--';
        kvcResultMiB.textContent = '';
        kvcResultFormula.textContent = t('msg.kvcErrSeq');
        return;
      }

      const dtypeBytes = quant.dtypeBytes;
      const bytes = computeKvCacheBytes(key, prof, quant, seqLen, batchSize);
      const gib = bytes / 1024 ** 3;
      const mib = bytes / 1024 ** 2;
      const seqLabel = seqLen.toLocaleString(loc());

      kvcResultGb.textContent = gib.toFixed(4);
      kvcResultMiB.textContent = `（≈ ${mib.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} MiB）`;

      if (prof.kvFormula === 'mla-dsa') {
        const standardBytes = computeStandardKvCacheBytes(prof, quant, seqLen, batchSize);
        const standardGib = standardBytes / 1024 ** 3;
        const mlaOnlyBytes = computeMlaKvCacheBytes(prof, quant, seqLen, batchSize);
        const mlaOnlyGib = mlaOnlyBytes / 1024 ** 3;
        const mlaElements = prof.compressedKvDim + prof.ropeHeadDim;
        const perLayerPerTokenBytes =
          (mlaElements + prof.dsaIndexHeadDim) * dtypeBytes + (prof.dsaIndexScaleBytes || 0);
        const bytesPerToken = perLayerPerTokenBytes * prof.layers;

        kvcResultSubtitle.textContent = t('msg.kvcSubtitleMlaDsa', { label: quant.label });
        kvcResultFormula.textContent = t('msg.kvcFormulaMlaDsa', {
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
        });
        return;
      }

      if (prof.kvFormula === 'mla') {
        const standardBytes = computeStandardKvCacheBytes(prof, quant, seqLen, batchSize);
        const standardGib = standardBytes / 1024 ** 3;
        const perLayerPerToken = prof.compressedKvDim + prof.ropeHeadDim;
        const bytesPerToken = perLayerPerToken * prof.layers * dtypeBytes;

        kvcResultSubtitle.textContent = t('msg.kvcSubtitleMla', { label: quant.label });
        kvcResultFormula.textContent = t('msg.kvcFormulaMla', {
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
        });
        return;
      }

      if (prof.kvFormula === 'qwen-hybrid-attention') {
        const totalLayers = prof.fullAttentionLayers + prof.linearAttentionLayers;
        const elementsPerLayer = 2 * prof.kvHeads * prof.headDim;
        const bytesPerLayer = elementsPerLayer * dtypeBytes;
        const bytesPerToken = bytesPerLayer * prof.fullAttentionLayers;
        const naiveFullGqaBytes =
          2 * totalLayers * prof.kvHeads * prof.headDim * seqLen * batchSize * dtypeBytes;
        const naiveFullGqaGib = naiveFullGqaBytes / 1024 ** 3;

        kvcResultSubtitle.textContent = t('msg.kvcSubtitleQwen', { label: quant.label });
        kvcResultFormula.textContent = t('msg.kvcFormulaQwen', {
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
        });
        return;
      }

      if (prof.kvFormula === 'v4-compressed' && v4KvCompressedAnchors[key]) {
        const anchor = v4KvCompressedAnchors[key];
        const standardBytes = computeStandardKvCacheBytes(prof, quant, seqLen, batchSize);
        const standardGib = standardBytes / 1024 ** 3;
        const bytesPerToken = bytes / seqLen / batchSize;
        const anchorKvGiB = anchor.bf16AnchorGiB * (quant.dtypeBytes / 2);

        kvcResultSubtitle.textContent = t('msg.kvcSubtitleV4', { label: quant.label });
        kvcResultFormula.textContent = t('msg.kvcFormulaV4', {
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
        });
        return;
      }

      const bytesPerToken =
        2 * prof.layers * prof.kvHeads * prof.headDim * dtypeBytes;
      kvcResultFormula.textContent = t('msg.kvcFormulaStandard', {
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
      });
    }

    function initialTabFromUrl() {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'dataflow') return 'dataflow';
      if (tab === 'mixed') return 'mixed';
      if (tab === 'separated') return 'separated';
      if (tab === 'kvcache') return 'kvcache';
      return 'principles';
    }

    function inferenceIframeSrc(path) {
      const lang = AidcI18n?.getLocale?.() || 'zh';
      return `inference/${path}?embed=1&lang=${lang}`;
    }

    function ensureInferenceIframe(iframe, path) {
      if (!iframe) return;
      const nextSrc = inferenceIframeSrc(path);
      if (iframe.getAttribute('src') !== nextSrc) {
        iframe.setAttribute('src', nextSrc);
      }
    }

    function syncInferenceIframes() {
      if (iframePrinciples?.getAttribute('src')) {
        ensureInferenceIframe(iframePrinciples, 'basic.html');
      }
      if (iframeDataflow?.getAttribute('src')) {
        ensureInferenceIframe(iframeDataflow, 'server-dataflow.html');
      }
    }

    function selectDeploymentTab(mode) {
      const tabs = [
        { id: 'principles', el: tabPrinciples, panel: panelPrinciples },
        { id: 'dataflow', el: tabDataflow, panel: panelDataflow },
        { id: 'mixed', el: tabMixed, panel: panelMixed },
        { id: 'separated', el: tabSeparated, panel: panelSeparated },
        { id: 'kvcache', el: tabKvcache, panel: panelKvcache },
      ];

      tabs.forEach(({ id, el, panel }) => {
        if (!el || !panel) return;
        const active = mode === id;
        el.setAttribute('aria-selected', active ? 'true' : 'false');
        el.tabIndex = active ? 0 : -1;
        el.className = active ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS;
        panel.classList.toggle('hidden', !active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      });

      if (mode === 'principles') {
        ensureInferenceIframe(iframePrinciples, 'basic.html');
      } else if (mode === 'dataflow') {
        ensureInferenceIframe(iframeDataflow, 'server-dataflow.html');
      } else if (mode === 'mixed') {
        updateEstimateMixed();
      } else if (mode === 'separated') {
        updateEstimateSeparated();
      } else {
        syncKvProfileFromModel();
        updateKvCacheEstimate();
      }
    }

    tabPrinciples?.addEventListener('click', () => selectDeploymentTab('principles'));
    tabDataflow?.addEventListener('click', () => selectDeploymentTab('dataflow'));
    tabMixed.addEventListener('click', () => selectDeploymentTab('mixed'));
    tabSeparated.addEventListener('click', () => selectDeploymentTab('separated'));
    tabKvcache.addEventListener('click', () => selectDeploymentTab('kvcache'));

    function updateEstimateMixed() {
      const modelName = modelNameInput.value.trim() || t('msg.unnamedModel');
      const npuModel = npuModelInput.value.trim() || t('msg.unspecifiedNpu');
      const modelSizeB = parseModelSize(modelSizeInput.value);
      const cardCount = Number(cardCountInput.value);
      const hbmCapacity = Number(hbmCapacityInput.value);
      const fixedWeightGb = fixedW8A8WeightGbByModel[modelNameInput.value];
      const usesFixedW8A8Weight = typeof fixedWeightGb === 'number';

      resultLabel.textContent = t('msg.resultLabelMixed', { model: modelName, npu: npuModel, cards: Number.isFinite(cardCount) ? cardCount : '-' });
      capacityLabel.textContent = t('msg.perCardCapacity', { value: Number.isFinite(hbmCapacity) ? hbmCapacity : '-' });

      if (!Number.isInteger(cardCount) || cardCount < 1) {
        setHbmHeadline(hbmUsed, hbmRemain, '--', '--', 'neutral');
        resultMessage.textContent = t('msg.errCardCount');
        hbmChart.innerHTML = '';
        return;
      }

      if (!Number.isFinite(hbmCapacity) || hbmCapacity <= 0) {
        setHbmHeadline(hbmUsed, hbmRemain, '--', '--', 'neutral');
        resultMessage.textContent = t('msg.errHbmCapacity');
        hbmChart.innerHTML = '';
        return;
      }

      if (!usesFixedW8A8Weight && (!Number.isFinite(modelSizeB) || modelSizeB <= 0)) {
        setHbmHeadline(hbmUsed, hbmRemain, '--', '--', 'neutral');
        resultMessage.textContent = t('msg.errModelSize');
        hbmChart.innerHTML = '';
        return;
      }

      let modelUsage;

      if (usesFixedW8A8Weight) {
        modelUsage = fixedWeightGb / cardCount;
      } else {
        modelUsage = (modelSizeB * 2) / cardCount;
      }

      const frameworkUsage = hbmCapacity * FRAMEWORK_OVERHEAD_OF_CAPACITY;
      let detailLine;

      const hbmPerCard = modelUsage + frameworkUsage;
      const remaining = Math.max(hbmCapacity - hbmPerCard, 0);
      const signedRemain = hbmCapacity - hbmPerCard;
      const overflow = Math.max(hbmPerCard - hbmCapacity, 0);
      const remainText = signedRemain.toFixed(2);
      setHbmHeadline(hbmUsed, hbmRemain, hbmPerCard.toFixed(2), remainText, signedRemain >= 0 ? 'good' : 'bad');

      if (usesFixedW8A8Weight) {
        const weightNote = modelNameInput.value.includes('W8A8')
          ? t('msg.weightNoteW8A8')
          : modelNameInput.value.includes('W4A8')
            ? t('msg.weightNoteW4A8')
            : '';
        detailLine = t('msg.mixedDetailFixed', {
          weight: fixedWeightGb,
          note: weightNote,
          cards: cardCount,
          usage: modelUsage.toFixed(2),
          framework: frameworkUsage.toFixed(2),
          remaining: remaining.toFixed(2),
          overflow: overflow > 0 ? t('msg.mixedDetailFixedOverflow', { overflow: overflow.toFixed(2) }) : '',
        });
      } else {
        const displayParam = formatModelParamBillions(modelSizeB);
        detailLine = t('msg.mixedDetailParam', {
          param: displayParam,
          cards: cardCount,
          usage: modelUsage.toFixed(2),
          framework: frameworkUsage.toFixed(2),
          remaining: remaining.toFixed(2),
          overflow: overflow > 0 ? t('msg.mixedDetailFixedOverflow', { overflow: overflow.toFixed(2) }) : '',
        });
      }

      resultMessage.textContent = detailLine;

      renderHbmChartInto(hbmChart, cardCount, hbmCapacity, modelUsage, frameworkUsage, remaining, overflow);
    }

    function updateEstimateSeparated() {
      const modelName = modelNameSep.value.trim() || t('msg.unnamedModel');
      const npuModel = npuModelSep.value.trim() || t('msg.unspecifiedNpu');
      const modelSizeB = parseModelSize(modelSizeSep.value);
      const hbmCapacity = Number(hbmCapacitySep.value);
      const layout = pdDeployLayouts[pdDeployMode.value];
      const fixedWeightGb = fixedW8A8WeightGbByModel[modelNameSep.value];
      const usesFixedW8A8Weight = typeof fixedWeightGb === 'number';

      let modelGb;
      if (usesFixedW8A8Weight) {
        modelGb = fixedWeightGb;
      } else if (Number.isFinite(modelSizeB) && modelSizeB > 0) {
        modelGb = modelSizeB * 2;
      } else {
        modelGb = NaN;
      }

      capacityLabelSep.textContent = t('msg.perCardCapacity', { value: Number.isFinite(hbmCapacity) ? hbmCapacity : '-' });

      if (!layout) {
        clearSepOutputs();
        resultLabelSep.textContent = `${modelName} · ${npuModel}`;
        resultMessageSep.textContent = t('msg.errPdMode');
        hbmSubtitleSep.textContent = t('results.hbmPerNpuBottleneck');
        return;
      }

      resultLabelSep.textContent = t('msg.resultLabelSep', { model: modelName, npu: npuModel, layout: t(layout.labelKey) });

      if (!Number.isFinite(hbmCapacity) || hbmCapacity <= 0) {
        clearSepOutputs();
        resultMessageSep.textContent = t('msg.errHbmCapacity');
        hbmSubtitleSep.textContent = t('results.hbmPerNpuBottleneck');
        return;
      }

      if (!usesFixedW8A8Weight && (!Number.isFinite(modelGb) || modelGb <= 0)) {
        clearSepOutputs();
        resultMessageSep.textContent = t('msg.errModelSize');
        hbmSubtitleSep.textContent = t('results.hbmPerNpuBottleneck');
        return;
      }

      const cardsPerPGroup = layout.pCardTotal / layout.pGroups;
      const cardsPerDGroup = layout.dCardTotal / layout.dGroups;

      if (
        !Number.isInteger(cardsPerPGroup) ||
        cardsPerPGroup < 1 ||
        !Number.isInteger(cardsPerDGroup) ||
        cardsPerDGroup < 1
      ) {
        clearSepOutputs();
        resultMessageSep.textContent = t('msg.errPdGroupCards');
        hbmSubtitleSep.textContent = t('results.hbmPerNpuBottleneck');
        return;
      }

      const frameworkUsage = hbmCapacity * FRAMEWORK_OVERHEAD_OF_CAPACITY;
      const modelUsageP = modelGb / cardsPerPGroup;
      const modelUsageD = modelGb / cardsPerDGroup;
      const usageP = modelUsageP + frameworkUsage;
      const usageD = modelUsageD + frameworkUsage;

      const bottleneckIsPrefill = usageP >= usageD;
      const bottleneckSide = bottleneckIsPrefill ? t('msg.sidePrefill') : t('msg.sideDecode');
      const usageB = bottleneckIsPrefill ? usageP : usageD;

      const signedRemainP = hbmCapacity - usageP;
      const signedRemainD = hbmCapacity - usageD;
      const signedRemainB = hbmCapacity - usageB;

      resultLabelSep.textContent = t('msg.resultLabelSepBottleneck', { model: modelName, npu: npuModel, layout: t(layout.labelKey), side: bottleneckSide });
      hbmSubtitleSep.textContent = t('msg.hbmSubtitleBottleneck', { side: bottleneckSide });

      setHbmHeadline(
        hbmUsedSep,
        hbmRemainSep,
        usageB.toFixed(2),
        signedRemainB.toFixed(2),
        signedRemainB >= 0 ? 'good' : 'bad'
      );

      const lineP = t('msg.linePrefill', {
        total: layout.pCardTotal,
        groups: layout.pGroups,
        perGroup: cardsPerPGroup,
        usage: usageP.toFixed(2),
        remain: signedRemainP.toFixed(2),
      });
      const lineD = t('msg.lineDecode', {
        total: layout.dCardTotal,
        groups: layout.dGroups,
        perGroup: cardsPerDGroup,
        usage: usageD.toFixed(2),
        remain: signedRemainD.toFixed(2),
      });
      const lineB = t('msg.lineBottleneck', { side: bottleneckSide });
      resultMessageSep.textContent = `${lineP}\n${lineD}\n${lineB}`;

      renderPdSepGroupedChart(hbmChartSep, layout, hbmCapacity, modelUsageP, modelUsageD, frameworkUsage);
    }

    function getSegmentWidth(value, total) {
      if (total <= 0 || value <= 0) {
        return 0;
      }

      return Math.max((value / total) * 100, 2);
    }

    /**
     * 生成横向堆叠条列表 HTML（不含外层容器）。
     * cardCount ≤ 5 时全部展示；否则展示前 4 条、中间省略、最后 1 条。
     */
    function buildBarChartRowsHtml(cardCount, hbmCapacity, modelUsage, frameworkUsage, rowLabelFn) {
      const hbmPerCard = modelUsage + frameworkUsage;
      const remaining = Math.max(hbmCapacity - hbmPerCard, 0);
      const overflow = Math.max(hbmPerCard - hbmCapacity, 0);
      const chartTotal = hbmCapacity + overflow;
      const frameworkWithinCapacity = Math.min(frameworkUsage, hbmCapacity);
      const modelWithinCapacity = Math.min(modelUsage, Math.max(hbmCapacity - frameworkWithinCapacity, 0));
      const frameworkWidth = getSegmentWidth(frameworkWithinCapacity, chartTotal);
      const modelWidth = getSegmentWidth(modelWithinCapacity, chartTotal);
      const remainingWidth = getSegmentWidth(remaining, chartTotal);
      const overflowWidth = getSegmentWidth(overflow, chartTotal);
      const barTitle = t('msg.barTitle', { framework: frameworkUsage.toFixed(2), model: modelUsage.toFixed(2), remaining: remaining.toFixed(2) });
      const barHtml = `
        <div class="h-8 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10" title="${barTitle}">
          <div class="flex h-full min-w-full">
            <div class="bg-amber-400" style="width: ${frameworkWidth}%"></div>
            <div class="bg-blue-400" style="width: ${modelWidth}%"></div>
            ${remaining > 0 ? `<div class="bg-emerald-400" style="width: ${remainingWidth}%"></div>` : ''}
            ${overflow > 0 ? `<div class="bg-rose-500" style="width: ${overflowWidth}%"></div>` : ''}
          </div>
        </div>
      `;

      function rowHtml(index) {
        const cardName = rowLabelFn(index);
        return `
          <div class="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-center">
            <div class="text-xs font-medium text-slate-400">${cardName}</div>
            ${barHtml}
          </div>
        `;
      }

      if (cardCount <= 5) {
        return Array.from({ length: cardCount }, (_, i) => rowHtml(i)).join('');
      }

      const lastIndex = cardCount - 1;
      const ellipsisRow = `
        <div class="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-center">
          <div class="text-xs font-medium text-slate-500">···</div>
          <div class="flex h-8 items-center rounded-full bg-slate-800/60 px-4 text-xs text-slate-500 ring-1 ring-white/5" title="${t('msg.chartEllipsisTitle', { count: cardCount - 5 })}">${t('msg.chartEllipsis')}</div>
        </div>
      `;
      return [0, 1, 2, 3].map((i) => rowHtml(i)).join('') + ellipsisRow + rowHtml(lastIndex);
    }

    function renderHbmChartInto(chartEl, cardCount, hbmCapacity, modelUsage, frameworkUsage, remaining, overflow) {
      chartEl.innerHTML = buildBarChartRowsHtml(cardCount, hbmCapacity, modelUsage, frameworkUsage, (i) =>
        `NPU ${String(i + 1).padStart(2, '0')}`
      );
    }

    /** PD分离：按 Prefill 组 / Decode 组分段展示，每组独立省略逻辑。 */
    function renderPdSepGroupedChart(chartEl, layout, hbmCapacity, modelUsageP, modelUsageD, frameworkUsage) {
      const cardsPerPGroup = layout.pCardTotal / layout.pGroups;
      const cardsPerDGroup = layout.dCardTotal / layout.dGroups;
      const sections = [];

      for (let g = 1; g <= layout.pGroups; g += 1) {
        const rows = buildBarChartRowsHtml(cardsPerPGroup, hbmCapacity, modelUsageP, frameworkUsage, (i) =>
          `P${g}-${String(i + 1).padStart(2, '0')}`
        );
        sections.push(`
          <div class="space-y-2">
            <p class="text-xs font-semibold text-slate-300">${t('msg.chartGroupPrefill', { group: g, cards: cardsPerPGroup })}</p>
            <div class="space-y-3">${rows}</div>
          </div>
        `);
      }

      for (let g = 1; g <= layout.dGroups; g += 1) {
        const rows = buildBarChartRowsHtml(cardsPerDGroup, hbmCapacity, modelUsageD, frameworkUsage, (i) =>
          `D${g}-${String(i + 1).padStart(2, '0')}`
        );
        sections.push(`
          <div class="space-y-2">
            <p class="text-xs font-semibold text-slate-300">${t('msg.chartGroupDecode', { group: g, cards: cardsPerDGroup })}</p>
            <div class="space-y-3">${rows}</div>
          </div>
        `);
      }

      chartEl.innerHTML = `<div class="space-y-8">${sections.join('')}</div>`;
    }

    modelNameInput.addEventListener('change', () => {
      modelSizeInput.value = modelSizeMap[modelNameInput.value] || '';
      updateEstimateMixed();
    });

    attachSyncedInputs([modelSizeInput, cardCountInput], updateEstimateMixed);

    npuModelInput.addEventListener('change', () => {
      syncNpuCapacityFromSelection();
      updateEstimateMixed();
    });

    panelMixed.querySelectorAll('[data-card-count]').forEach((button) => {
      button.addEventListener('click', () => {
        cardCountInput.value = button.dataset.cardCount;
        updateEstimateMixed();
      });
    });

    modelNameSep.addEventListener('change', () => {
      modelSizeSep.value = modelSizeMap[modelNameSep.value] || '';
      updateEstimateSeparated();
    });

    attachSyncedInputs([modelSizeSep, pdDeployMode], updateEstimateSeparated);

    npuModelSep.addEventListener('change', () => {
      syncNpuCapacitySepFromSelection();
      updateEstimateSeparated();
    });

    modelNameKvc.addEventListener('change', () => {
      syncKvProfileFromModel();
      updateKvCacheEstimate();
    });

    attachSyncedInputs([kvcTokenCount, kvcBatchSize], updateKvCacheEstimate);

    panelKvcache.querySelectorAll('[data-kvc-tokens]').forEach((button) => {
      button.addEventListener('click', () => {
        kvcTokenCount.value = button.dataset.kvcTokens;
        updateKvCacheEstimate();
      });
    });

    syncNpuCapacityFromSelection();
    syncNpuCapacitySepFromSelection();
    syncKvProfileFromModel();

    resultMessageSep.textContent = t('results.sepPlaceholder');

    selectDeploymentTab(initialTabFromUrl());

  window.refreshIndexPageI18n = function refreshIndexPageI18n() {
    document.querySelectorAll('#pdDeployMode option').forEach((opt) => {
      const key = opt.value === '32-1p1d' ? 'pd.layout32' : opt.value === '48-1p1d' ? 'pd.layout48' : null;
      if (key) opt.textContent = t(key);
    });
    syncInferenceIframes();
    AidcI18n.applyDom();
    const mode =
      tabKvcache?.getAttribute('aria-selected') === 'true'
        ? 'kvcache'
        : tabSeparated?.getAttribute('aria-selected') === 'true'
          ? 'separated'
          : tabMixed?.getAttribute('aria-selected') === 'true'
            ? 'mixed'
            : tabDataflow?.getAttribute('aria-selected') === 'true'
              ? 'dataflow'
              : 'principles';
    selectDeploymentTab(mode);
  };
}
window.initIndexPage = initIndexPage;
