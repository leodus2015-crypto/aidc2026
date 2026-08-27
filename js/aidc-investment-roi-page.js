/**
 * Investment ROI page logic — single-page i18n via AidcI18n lookup + ROI_PAGE_CONFIG.
 * Requires AidcInvestmentRoiInit.applyConfig() before boot.
 */
(function () {
  let configKeys = {
    defaults: 'roi.defaults',
    cloudCompare: 'roi.cloud_compare',
  };
  let LOCAL_ROI_DEFAULTS = {};
  let LOCAL_CLOUD_COMPARE = {};

  function getLocale() {
    return window.AidcI18n?.getLocale?.() || window.ROI_PAGE_CONFIG?.locale || 'zh';
  }

  function localeTag() {
    return window.AidcI18n?.localeTag?.() || (getLocale() === 'en' ? 'en-US' : 'zh-CN');
  }

  function applyPageConfig() {
    const page = window.ROI_PAGE_CONFIG || {};
    configKeys = page.configKeys || configKeys;
    LOCAL_ROI_DEFAULTS = page.localDefaults || {};
    LOCAL_CLOUD_COMPARE = page.localCloudCompare || {};
    CLOUD_COMPARE = JSON.parse(JSON.stringify(LOCAL_CLOUD_COMPARE));
  }

  function L(s) {
    if (!s) return s;
    if (window.AidcI18n?.getLookupText) return AidcI18n.getLookupText(s);
    return s;
  }
  function Lp(key, params) {
    let text = L(key);
    if (params) Object.entries(params).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, String(v)); });
    return text;
  }

  const $ = (id) => document.getElementById(id);
  let staticLookupNodes = null;

  function translateStaticLookupText() {
    if (!staticLookupNodes) {
      staticLookupNodes = [];
      const root = document.body;
      if (root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const parent = node.parentElement;
          const raw = node.nodeValue || '';
          const match = raw.match(/^(\s*)(.*?)(\s*)$/s);
          const key = match?.[2] || '';
          if (
            key &&
            parent &&
            !parent.closest('[data-i18n], [data-i18n-html], script, style') &&
            window.AidcI18n?.hasLookupText?.(key)
          ) {
            staticLookupNodes.push({ node, key, before: match[1], after: match[3] });
          }
          node = walker.nextNode();
        }
      }
    }
    staticLookupNodes.forEach(({ node, key, before, after }) => {
      node.nodeValue = before + L(key) + after;
    });
  }

  const SCALE_PRESETS = {
    '768': { computeP: 768, clusterMw: 2.5 },
    '384': { computeP: 384, clusterMw: 1.3 },
  };
  let activeScalePreset = '768';

  const SPEC = {
    pPerCard: 1,
    defaultUnitPriceWan: LOCAL_ROI_DEFAULTS.npuUnitPrice ?? 60,
    presets: {
      'ds-v4': { tpsInputMiss: 600, tpsInputHit: 12000, tpsOutput: 100 },
      'glm-52': { tpsInputMiss: 400, tpsInputHit: 1600, tpsOutput: 12 },
    },
  };
  const KEY_PASSWORD = 'aidc2026';

  let CLOUD_COMPARE = {};
  let configLoadMeta = { defaults: 'local', cloud: 'local' };

  let activeScenario = 'ds-v4';
  let syncLock = false;
  let keyParamsUnlocked = false;

  const fmtNum = (n, d = 2) => Number(n).toLocaleString(localeTag(), { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtMoney = (y) => {
    if (getLocale() === 'en') {
      const abs = Math.abs(y);
      if (abs >= 1e9) return '$' + fmtNum(y / 1e9, 2) + 'B';
      if (abs >= 1e6) return '$' + fmtNum(y / 1e6, 2) + 'M';
      if (abs >= 1e3) return '$' + fmtNum(y / 1e3, 1) + 'K';
      return '$' + fmtNum(y, 0);
    }
    return fmtNum(y / 10000, 1) + ' ' + L('万元');
  };
  const fmtMoneyWanPerYear = (y) => {
    if (getLocale() === 'en') {
      const abs = Math.abs(y);
      if (abs >= 1e9) return '$' + fmtNum(y / 1e9, 2) + 'B/yr';
      if (abs >= 1e6) return '$' + fmtNum(y / 1e6, 2) + 'M/yr';
      return '$' + fmtNum(y / 1e3, 1) + 'K/yr';
    }
    return fmtNum(y / 10000, 1) + ' ' + L('万元/年');
  };
  const fmtMoneyWanPerDay = (y) => {
    if (getLocale() === 'en') {
      const daily = y / 365;
      const abs = Math.abs(daily);
      if (abs >= 1e9) return '$' + fmtNum(daily / 1e9, 2) + 'B/day';
      if (abs >= 1e6) return '$' + fmtNum(daily / 1e6, 2) + 'M/day';
      return '$' + fmtNum(daily / 1e3, 1) + 'K/day';
    }
    return fmtNum(y / 10000 / 365, 2) + ' ' + L('万元/天');
  };
  const SEC_PER_DAY = 86400;
  const YI = 1e8;

  function roundTps(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    return fmtNum(n, 4);
  }

  function formatYiPerDay(tps) {
    const yi = Number(tps) * SEC_PER_DAY / YI;
    if (!Number.isFinite(yi)) return '';
    if (yi >= 100) return fmtNum(yi, 2);
    if (yi >= 1) return fmtNum(yi, 4);
    return fmtNum(yi, 6);
  }

  function syncTpsToDailyYi() {
    if (syncLock) return;
    syncLock = true;
    if ($('dailyYiInputMiss')) $('dailyYiInputMiss').value = formatYiPerDay($('tpsInputMiss').value);
    if ($('dailyYiInputHit')) $('dailyYiInputHit').value = formatYiPerDay($('tpsInputHit').value);
    if ($('dailyYiOutput')) $('dailyYiOutput').value = formatYiPerDay($('tpsOutput').value);
    syncLock = false;
  }

  function syncDailyYiToTps() {
    if (syncLock) return;
    syncLock = true;
    if ($('tpsInputMiss')) $('tpsInputMiss').value = roundTps(Number($('dailyYiInputMiss').value) * YI / SEC_PER_DAY);
    if ($('tpsInputHit')) $('tpsInputHit').value = roundTps(Number($('dailyYiInputHit').value) * YI / SEC_PER_DAY);
    if ($('tpsOutput')) $('tpsOutput').value = roundTps(Number($('dailyYiOutput').value) * YI / SEC_PER_DAY);
    syncLock = false;
  }

  function onTpsInputChange() {
    syncTpsToDailyYi();
    renderAll();
  }

  function onDailyYiInputChange() {
    syncDailyYiToTps();
    renderAll();
  }

  const fmtTokens = (n) => {
    if (n >= 1e12) return fmtNum(n / 1e12, 2) + ' T';
    if (n >= 1e9) return fmtNum(n / 1e9, 2) + ' B';
    if (n >= 1e6) return fmtNum(n / 1e6, 2) + ' M';
    return fmtNum(n, 0);
  };

  function syncScalePresetHighlight() {
    const p = Number($('computeP').value);
    const mw = Number($('clusterMw').value);
    let matched = '';
    Object.entries(SCALE_PRESETS).forEach(([id, preset]) => {
      if (Math.abs(p - preset.computeP) < 0.01 && Math.abs(mw - preset.clusterMw) < 0.0001) matched = id;
    });
    activeScalePreset = matched;
    document.querySelectorAll('.scale-preset').forEach((btn) => {
      const on = btn.dataset.preset === matched;
      btn.className = 'scale-preset rounded-xl px-3 py-1.5 text-xs font-semibold transition '
        + (on ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200');
    });
  }

  function tokenMix(tpsMiss, tpsHit, tpsOut) {
    const total = tpsMiss + tpsHit + tpsOut;
    if (total <= 0) return { miss: 0, hit: 0, out: 0 };
    return { miss: tpsMiss / total, hit: tpsHit / total, out: tpsOut / total };
  }

  function blendedCloudPrice(cloud, mix) {
    return mix.miss * cloud.inputMiss + mix.hit * cloud.inputHit + mix.out * cloud.output;
  }

  function blendedRefPrice(sc, mix) {
    const refMiss = sc.refInputMiss ?? Math.min(...sc.clouds.map((c) => c.inputMiss));
    const refHit = sc.refInputHit ?? Math.min(...sc.clouds.map((c) => c.inputHit));
    const refOut = sc.refOutput ?? Math.min(...sc.clouds.map((c) => c.output));
    return mix.miss * refMiss + mix.hit * refHit + mix.out * refOut;
  }

  function cloudPriceByType(cloud, type) {
    if (type === 'miss') return cloud.inputMiss;
    if (type === 'hit') return cloud.inputHit;
    return cloud.output;
  }

  function selfCostByType(s, type) {
    if (type === 'miss') return s.costPerMMiss;
    if (type === 'hit') return s.costPerMHit;
    return s.costPerMOut;
  }

  function applyRoiConfig(cfg) {
    if (!cfg) return;
    const setNum = (id, val) => {
      if (val == null || val === '' || !$(id)) return;
      $(id).value = val;
    };
    if (cfg.serviceModel === 'glm-51') cfg.serviceModel = 'glm-52';
    setNum('computeP', cfg.computeP);
    setNum('clusterMw', cfg.clusterMw != null ? fmtNum(Number(cfg.clusterMw), 4) : null);
    setNum('pctItDevice', cfg.pctItDevice);
    setNum('pctPowerCool', cfg.pctPowerCool);
    setNum('pctLandBuild', cfg.pctLandBuild);
    setNum('npuUnitPrice', cfg.npuUnitPrice);
    setNum('ascendInItPct', cfg.ascendInItPct);
    setNum('deprecYears', cfg.deprecYears);
    setNum('pue', cfg.pue);
    setNum('elecPrice', cfg.elecPrice);
    setNum('utilization', cfg.utilization);
    setNum('tpsInputMiss', cfg.tpsInputMiss);
    setNum('tpsInputHit', cfg.tpsInputHit);
    setNum('tpsOutput', cfg.tpsOutput);
    setNum('pctMixMiss', cfg.pctMixMiss);
    setNum('pctMixHit', cfg.pctMixHit);
    setNum('pctMixOut', cfg.pctMixOut);
    if (cfg.annualFixedOpex != null) $('annualFixedOpex').value = cfg.annualFixedOpex;
    if (cfg.capexOpexPct != null) $('capexOpexPct').value = cfg.capexOpexPct;
    if (cfg.serviceModel) $('serviceModel').value = cfg.serviceModel;
  }

  function collectRoiConfigForSave() {
    return {
      schemaVersion: 1,
      computeP: Number($('computeP').value),
      clusterMw: Number($('clusterMw').value),
      pctItDevice: Number($('pctItDevice').value),
      pctPowerCool: Number($('pctPowerCool').value),
      pctLandBuild: Number($('pctLandBuild').value),
      npuUnitPrice: Number($('npuUnitPrice').value),
      ascendInItPct: Number($('ascendInItPct').value),
      deprecYears: Number($('deprecYears').value),
      pue: Number($('pue').value),
      elecPrice: Number($('elecPrice').value),
      utilization: Number($('utilization').value),
      tpsInputMiss: Number($('tpsInputMiss').value),
      tpsInputHit: Number($('tpsInputHit').value),
      tpsOutput: Number($('tpsOutput').value),
      pctMixMiss: Number($('pctMixMiss').value),
      pctMixHit: Number($('pctMixHit').value),
      pctMixOut: Number($('pctMixOut').value),
      annualFixedOpex: Number($('annualFixedOpex').value),
      capexOpexPct: Number($('capexOpexPct').value),
      serviceModel: $('serviceModel').value,
    };
  }

  function mergeCloudCompare(remote) {
    if (!remote || typeof remote !== 'object') return;
    CLOUD_COMPARE = JSON.parse(JSON.stringify(LOCAL_CLOUD_COMPARE));
    const r = { ...remote };
    delete r['glm-51'];
    Object.keys(r).forEach((k) => {
      if (k === 'schemaVersion') return;
      if (r[k] && typeof r[k] === 'object') {
        CLOUD_COMPARE[k] = { ...CLOUD_COMPARE[k], ...r[k] };
      }
    });
  }

  function updateConfigSourceBadge() {
    const el = $('configSourceBadge');
    if (!el) return;
    const d = configLoadMeta.defaults;
    const c = configLoadMeta.cloud;
    if (d === 'database' && c === 'database') {
      el.textContent = L('配置来源：云端数据库（全量同步）');
      el.className = 'mt-2 text-xs font-medium text-emerald-700';
    } else if (d === 'database' || c === 'database') {
      el.textContent = L('配置来源：部分云端 + 部分本地默认');
      el.className = 'mt-2 text-xs font-medium text-amber-700';
    } else {
      el.textContent = L('配置来源：本地默认（数据库不可用或未配置）');
      el.className = 'mt-2 text-xs font-medium text-slate-500';
    }
  }

  async function syncConfigToCloud() {
    const hint = $('syncConfigHint');
    if (!keyParamsUnlocked) {
      hint.textContent = L('请先开启并解锁关键参数');
      hint.className = 'text-xs text-rose-600';
      return;
    }
    hint.textContent = L('同步中…');
    hint.className = 'text-xs text-slate-500';
    try {
      const token = KEY_PASSWORD;
      await AidcConfig.save(configKeys.defaults, collectRoiConfigForSave(), token);
      await AidcConfig.save(configKeys.cloudCompare, { schemaVersion: 1, ...CLOUD_COMPARE }, token);
      hint.textContent = L('已同步到云端');
      hint.className = 'text-xs text-emerald-700';
      configLoadMeta = { defaults: 'database', cloud: 'database' };
      updateConfigSourceBadge();
    } catch (err) {
      hint.textContent = Lp('同步失败：{msg}', { msg: err.message || err });
      hint.className = 'text-xs text-rose-600';
    }
  }

  function readState() {
    const computeP = Number($('computeP').value);
    const clusterMw = Number($('clusterMw').value);
    const npuCount = Math.round(computeP);
    $('npuCount').value = npuCount;

    const unitPriceWan = Number($('npuUnitPrice').value);
    const ascendPct = Number($('ascendInItPct').value) / 100;
    const itPct = Number($('pctItDevice').value) / 100;
    const powerPct = Number($('pctPowerCool').value) / 100;
    const landPct = Number($('pctLandBuild').value) / 100;

    const ascendCost = npuCount * unitPriceWan * 10000;
    const itEquipment = ascendPct > 0 ? ascendCost / ascendPct : NaN;
    const totalCapex = itPct > 0 ? itEquipment / itPct : NaN;

    const deprecYears = Number($('deprecYears').value);
    const pue = Number($('pue').value);
    const elecPrice = Number($('elecPrice').value);
    const utilization = Number($('utilization').value) / 100;
    const annualFixedOpexYuan = Number($('annualFixedOpex').value) * 10000;
    const capexOpexPct = Number($('capexOpexPct').value) / 100;
    const tpsInputMiss = Number($('tpsInputMiss').value);
    const tpsInputHit = Number($('tpsInputHit').value);
    const tpsOutput = Number($('tpsOutput').value);
    const pctMixMiss = Number($('pctMixMiss').value) / 100;
    const pctMixHit = Number($('pctMixHit').value) / 100;
    const pctMixOut = Number($('pctMixOut').value) / 100;

    const annualMissTokens = npuCount * tpsInputMiss * 86400 * 365 * utilization;
    const annualHitTokens = npuCount * tpsInputHit * 86400 * 365 * utilization;
    const annualOutputTokens = npuCount * tpsOutput * 86400 * 365 * utilization;
    const annualTotalTokens = annualMissTokens + annualHitTokens + annualOutputTokens;
    const annualDep = totalCapex / deprecYears;
    const annualPower = clusterMw * 1000 * 8760 * pue * utilization * elecPrice;
    const annualMaint = totalCapex * capexOpexPct;
    const annualOps = annualFixedOpexYuan + annualMaint;
    const annualCost = annualDep + annualPower + annualOps;

    const missTokensM = annualMissTokens / 1e6;
    const hitTokensM = annualHitTokens / 1e6;
    const outputTokensM = annualOutputTokens / 1e6;
    const totalTokensM = annualTotalTokens / 1e6;
    const costPerMMiss = missTokensM > 0 ? (annualCost * pctMixMiss) / missTokensM : NaN;
    const costPerMHit = hitTokensM > 0 ? (annualCost * pctMixHit) / hitTokensM : NaN;
    const costPerMOut = outputTokensM > 0 ? (annualCost * pctMixOut) / outputTokensM : NaN;
    const costPerM = outputTokensM > 0 ? annualCost / outputTokensM : NaN;
    const costPerMBlended = totalTokensM > 0 ? annualCost / totalTokensM : NaN;

    const mix = tokenMix(tpsInputMiss, tpsInputHit, tpsOutput);
    const sc = CLOUD_COMPARE[activeScenario];
    const refBlended = blendedRefPrice(sc, mix);
    const revenue = totalTokensM * refBlended;
    const profit = revenue - annualCost;
    const fixed = annualDep + annualOps;
    const tokensBaseM = utilization > 0 ? totalTokensM / utilization : 0;
    const powerBase = utilization > 0 ? annualPower / utilization : annualPower;
    const marginal = refBlended * tokensBaseM - powerBase;
    const breakeven = marginal > 0 ? fixed / marginal : NaN;
    const payback = profit > 0 ? totalCapex / profit : NaN;

    return {
      computeP, clusterMw, npuCount, ascendCost, itEquipment, totalCapex,
      powerCapex: totalCapex * powerPct, landCapex: totalCapex * landPct,
      annualDep, annualPower, annualOps, annualCost,
      annualMissTokens, annualHitTokens, annualTokens: annualOutputTokens, annualTotalTokens,
      costPerMMiss, costPerMHit, costPerMOut, costPerM, costPerMBlended, refBlended, tokenMix: mix,
      refInputMiss: sc.refInputMiss, refInputHit: sc.refInputHit, refOutput: sc.refOutput,
      revenue, profit, breakeven, payback,
      deprecYears, utilization, pue, elecPrice, tpsInputMiss, tpsInputHit, tpsOutput,
      pctMixMiss: pctMixMiss * 100, pctMixHit: pctMixHit * 100, pctMixOut: pctMixOut * 100,
      annualFixedOpexYuan, annualMaint, itPct, powerPct, landPct, ascendPct,
    };
  }

  function updatePctMixHint() {
    const sum = Number($('pctMixMiss').value) + Number($('pctMixHit').value) + Number($('pctMixOut').value);
    const el = $('pctMixSumHint');
    if (!el) return;
    if (Math.abs(sum - 100) < 0.05) {
      el.textContent = L('三项占比合计 100%');
      el.className = 'mt-1.5 text-xs text-emerald-600';
    } else {
      el.textContent = Lp('三项占比合计 {sum}%（应为 100%）', { sum: fmtNum(sum, 1) });
      el.className = 'mt-1.5 text-xs text-rose-600';
    }
  }

  function updatePctSumHint() {
    const sum = Number($('pctItDevice').value) + Number($('pctPowerCool').value) + Number($('pctLandBuild').value);
    const el = $('pctSumHint');
    if (Math.abs(sum - 100) < 0.01) {
      el.textContent = L('三项合计 100%');
      el.className = 'mt-2 text-xs text-emerald-600';
    } else {
      el.textContent = Lp('三项合计 {sum}%（应为 100%）', { sum: fmtNum(sum, 0) });
      el.className = 'mt-2 text-xs text-rose-600';
    }
  }

  function syncAscendNet(changed) {
    if (changed === 'ascend') {
      $('netStorageInItPct').value = 100 - Number($('ascendInItPct').value);
    } else if (changed === 'net') {
      $('ascendInItPct').value = 100 - Number($('netStorageInItPct').value);
    }
  }

  function rebalanceProjectPct(changedId) {
    const it = Number($('pctItDevice').value);
    const power = Number($('pctPowerCool').value);
    const land = Number($('pctLandBuild').value);
    if (changedId === 'pctLandBuild') {
      $('pctPowerCool').value = Math.max(0, 100 - it - land);
    } else if (changedId === 'pctItDevice') {
      $('pctLandBuild').value = Math.max(0, 100 - it - power);
    } else {
      $('pctLandBuild').value = Math.max(0, 100 - it - power);
    }
    updatePctSumHint();
  }

  function syncFromComputeP() {
    if (syncLock) return;
    syncLock = true;
    $('npuCount').value = Math.round(Number($('computeP').value));
    syncLock = false;
    syncScalePresetHighlight();
    renderAll();
  }

  function applyScalePreset(presetId) {
    const preset = SCALE_PRESETS[presetId];
    if (!preset) return;
    $('computeP').value = fmtNum(preset.computeP, preset.computeP % 1 === 0 ? 0 : 2);
    $('clusterMw').value = fmtNum(preset.clusterMw, 4);
    $('npuCount').value = Math.round(preset.computeP);
    syncScalePresetHighlight();
    renderAll();
  }

  function renderAll() {
    const s = readState();
    updatePctMixHint();
    $('keyTotalCapex').textContent = fmtMoney(s.totalCapex);
    $('keyItCapex').textContent = fmtMoney(s.itEquipment);
    $('keyAnnualDep').textContent = fmtMoney(s.annualDep);
    $('keyAnnualPower').textContent = fmtMoney(s.annualPower);
    const maintEl = $('keyAnnualMaint');
    if (maintEl) maintEl.textContent = fmtMoney(s.annualMaint);
    $('keyAnnualOps').textContent = fmtMoney(s.annualOps);
    $('keyAnnualOpexTotal').textContent = fmtMoney(s.annualPower + s.annualOps);
    $('keyAnnualCostTotal').textContent = fmtMoneyWanPerYear(s.annualCost);
    const perDayEl = $('keyAnnualCostPerDay');
    if (perDayEl) perDayEl.textContent = fmtMoneyWanPerDay(s.annualCost);
    $('keyCostPerMMiss').textContent = fmtNum(s.costPerMMiss, 2);
    $('keyCostPerMHit').textContent = fmtNum(s.costPerMHit, 2);
    $('keyCostPerMOut').textContent = fmtNum(s.costPerMOut, 2);

    $('cmpSelfMiss').textContent = fmtNum(s.costPerMMiss, 2);
    $('cmpSelfHit').textContent = fmtNum(s.costPerMHit, 2);
    $('cmpSelfOut').textContent = fmtNum(s.costPerMOut, 2);
    const sc = CLOUD_COMPARE[activeScenario];
    const total = sc.clouds.length;
    const cheaperByType = {
      miss: sc.clouds.filter((c) => s.costPerMMiss > c.inputMiss).length,
      hit: sc.clouds.filter((c) => s.costPerMHit > c.inputHit).length,
      out: sc.clouds.filter((c) => s.costPerMOut > c.output).length,
    };
    const refEl = $('cmpRefEff');
    if (refEl) {
      const minMiss = Math.min(...sc.clouds.map((c) => c.inputMiss));
      const minHit = Math.min(...sc.clouds.map((c) => c.inputHit));
      const minOut = Math.min(...sc.clouds.map((c) => c.output));
      refEl.textContent = `${fmtNum(minMiss, 2)} / ${fmtNum(minHit, 2)} / ${fmtNum(minOut, 2)}`;
    }
    $('cmpVerdict').innerHTML = `<span class="text-slate-700">${Lp('公开价对比：未命中 {miss}/{total} 家低于自建 · 命中 {hit}/{total} · 输出 {out}/{total}', {
      miss: cheaperByType.miss,
      hit: cheaperByType.hit,
      out: cheaperByType.out,
      total,
    })}</span>`;
    renderCompareChart(s);
    renderFullMetrics(s);
  }

  function renderComparePanel(title, unitLabel, s, sc, type) {
    const selfCost = selfCostByType(s, type);
    const items = sc.clouds.map((c) => ({
      name: c.name,
      price: cloudPriceByType(c, type),
    }));
    items.push({ name: L('★ 自建'), price: selfCost, isSelf: true });
    items.sort((a, b) => a.price - b.price);
    const maxP = Math.max(...items.map((i) => i.price), 0.01) * 1.15;
    return `
      <div class="aidc-inset-panel cmp-price-panel rounded-2xl p-4">
        <p class="text-sm font-semibold text-slate-800">${title}</p>
        <p class="mt-0.5 text-[11px] leading-4 text-slate-500">${unitLabel}</p>
        <div class="mt-3 space-y-2">
          ${items.map((item) => {
            const pct = Math.max(3, (item.price / maxP) * 100);
            const barCls = item.isSelf
              ? 'bg-gradient-to-r from-amber-400 to-amber-500'
              : 'bg-gradient-to-r from-blue-400 to-blue-600';
            const cheaper = item.isSelf ? null : item.price < selfCost;
            const hint = item.isSelf
              ? L('自建（该类 Token）')
              : (cheaper ? L('低于自建') : L('高于自建'));
            const hintCls = item.isSelf
              ? 'text-slate-400'
              : (cheaper ? 'text-emerald-600' : 'text-rose-600');
            return `<div class="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2 text-xs sm:grid-cols-[5rem_1fr_3.25rem]">
              <div class="min-w-0">
                <span class="${item.isSelf ? 'font-bold text-amber-800' : 'text-slate-700'} block truncate">${item.name}</span>
                <span class="text-[10px] ${hintCls} block truncate">${hint}</span>
              </div>
              <div class="cmp-bar-track h-5 overflow-hidden rounded-md bg-white"><div class="${barCls} h-full rounded-md transition-all duration-300" style="width:${pct}%"></div></div>
              <span class="tabular-nums text-right font-medium text-slate-700">${fmtNum(item.price, 2)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function renderCompareChart(s) {
    const sc = CLOUD_COMPARE[activeScenario];
    const noteEl = $('cmpPricingNote');
    if (noteEl) {
      const note = sc.pricingNote ? L(sc.pricingNote) : '';
      const updated = sc.updatedAt ? Lp('更新 {date}', { date: sc.updatedAt }) : '';
      noteEl.textContent = [note, updated].filter(Boolean).join(' · ');
    }
    $('compareChart').innerHTML = `
      <p class="text-sm font-semibold text-slate-800">${L(sc.title)}${L(' · 三类 Token 公开价对比')}</p>
      <p class="mt-1 text-xs text-slate-500">${Lp('自建 {miss} / {hit} / {out} 元/百万 Token · 云侧为各平台公开价', {
        miss: fmtNum(s.costPerMMiss, 2),
        hit: fmtNum(s.costPerMHit, 2),
        out: fmtNum(s.costPerMOut, 2),
      })}</p>
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        ${renderComparePanel(L('输入 · 未命中'), L('元/百万 Token（云公开价 vs 自建）'), s, sc, 'miss')}
        ${renderComparePanel(L('输入 · 命中'), L('元/百万 Token（云公开价 vs 自建）'), s, sc, 'hit')}
        ${renderComparePanel(L('输出'), L('元/百万 Token（云公开价 vs 自建）'), s, sc, 'out')}
      </div>`;
  }

  function renderFullMetrics(s) {
    const rows = [
      [L('算力规模 P'), fmtNum(s.computeP, 2) + ' P', L('1 卡 = 1P（2026H2）')],
      [L('NPU 数量'), s.npuCount + ' ' + L('卡'), L('= P 取整')],
      [L('集群 IT 功率'), fmtNum(s.clusterMw, 4) + ' MW', L('默认值，可以手工修改')],
      [L('昇腾采购'), fmtMoney(s.ascendCost), L('P × 单卡价')],
      [L('IT 设备投资'), fmtMoney(s.itEquipment), Lp('昇腾 ÷ {pct}%', { pct: fmtNum(s.ascendPct * 100, 0) })],
      [L('供电/散热投资'), fmtMoney(s.powerCapex), Lp('总投资 × {pct}%', { pct: fmtNum(s.powerPct * 100, 0) })],
      [L('土地/建筑投资'), fmtMoney(s.landCapex), Lp('总投资 × {pct}%', { pct: fmtNum(s.landPct * 100, 0) })],
      [L('总投资 CAPEX'), fmtMoney(s.totalCapex), L('IT 设备 ÷ IT 工程占比')],
      [L('年输出 Token'), fmtTokens(s.annualTokens), L('P × 输出 t/s × 86400 × 365 × u')],
      [L('年输入·未命中'), fmtTokens(s.annualMissTokens), L('P × 未命中 t/s × 86400 × 365 × u')],
      [L('年输入·命中'), fmtTokens(s.annualHitTokens), L('P × 命中 t/s × 86400 × 365 × u')],
      [L('年 Token 合计'), fmtTokens(s.annualTotalTokens), L('未命中 + 命中 + 输出')],
      [L('输入/输出 t/s'), `${fmtNum(s.tpsInputMiss, 0)} / ${fmtNum(s.tpsInputHit, 0)} / ${fmtNum(s.tpsOutput, 1)}`, L('未命中 / 命中 / 输出')],
      [L('年折旧'), fmtMoney(s.annualDep), Lp('{years} 年', { years: s.deprecYears })],
      [L('年电费'), fmtMoney(s.annualPower), L('MW × 8760 × PUE × u × 电价')],
      [L('年全成本'), fmtMoney(s.annualCost), L('年折旧 + 年电费 + 年运维')],
      [L('自建·未命中 / M'), fmtNum(s.costPerMMiss, 3) + ' ' + L('元'), L('年全成本 × 未命中占比 ÷ 年未命中 Token')],
      [L('自建·命中 / M'), fmtNum(s.costPerMHit, 3) + ' ' + L('元'), L('年全成本 × 命中占比 ÷ 年命中 Token')],
      [L('自建·输出 / M'), fmtNum(s.costPerMOut, 3) + ' ' + L('元'), L('年全成本 × 输出占比 ÷ 年输出 Token')],
      [L('对标均摊价'), fmtNum(s.refBlended, 2) + ' ' + L('元/M'), L('按 t/s 占比加权云价')],
      [L('年净利润（对标）'), fmtMoney(s.profit), Lp('对标均摊 {price} 元/M', { price: fmtNum(s.refBlended, 2) })],
      [L('盈亏平衡利用率'), Number.isFinite(s.breakeven) && s.breakeven <= 1 ? fmtNum(s.breakeven * 100, 1) + '%' : '—', L('固定 ÷ 边际')],
      [L('静态回收期'), Number.isFinite(s.payback) ? fmtNum(s.payback, 1) + ' ' + L('年') : '—', L('CAPEX ÷ 年利润')],
    ];
    $('fullMetricsBody').innerHTML = rows.map(([k, v, n]) =>
      `<tr><td class="px-4 py-2.5 font-medium">${k}</td><td class="px-4 py-2.5 tabular-nums">${v}</td><td class="hidden px-4 py-2.5 text-slate-500 md:table-cell">${n}</td></tr>`
    ).join('');
  }

  function applyServiceModel() {
    const svc = $('serviceModel').value;
    if (svc === 'ds-v4' || svc === 'glm-52') {
      const preset = SPEC.presets[svc];
      $('tpsInputMiss').value = preset.tpsInputMiss;
      $('tpsInputHit').value = preset.tpsInputHit;
      $('tpsOutput').value = preset.tpsOutput;
      if (LOCAL_ROI_DEFAULTS.pctMixMiss != null) $('pctMixMiss').value = LOCAL_ROI_DEFAULTS.pctMixMiss;
      if (LOCAL_ROI_DEFAULTS.pctMixHit != null) $('pctMixHit').value = LOCAL_ROI_DEFAULTS.pctMixHit;
      if (LOCAL_ROI_DEFAULTS.pctMixOut != null) $('pctMixOut').value = LOCAL_ROI_DEFAULTS.pctMixOut;
      activeScenario = svc;
    } else {
      renderAll();
      return;
    }
    document.querySelectorAll('.cmp-tab').forEach((b) => {
      const on = b.dataset.scenario === activeScenario;
      b.className = 'cmp-tab rounded-xl px-4 py-2 text-sm font-semibold transition ' + (on ? 'text-blue-700 shadow-sm bg-white' : 'text-slate-600 hover:bg-white/80');
    });
    syncTpsToDailyYi();
    renderAll();
  }

  function showPwdOverlay() {
    $('pwdOverlay').classList.remove('hidden');
    $('pwdOverlay').classList.add('flex');
    $('pwdInput').value = '';
    $('pwdError').classList.add('hidden');
    $('pwdInput').focus();
  }

  function hidePwdOverlay() {
    $('pwdOverlay').classList.add('hidden');
    $('pwdOverlay').classList.remove('flex');
  }

  function setKeyParamsVisible(visible) {
    keyParamsUnlocked = visible;
    $('keyParamsPanel').classList.toggle('hidden', !visible);
    $('calcProcessPanel').classList.toggle('hidden', !visible);
    $('keyParamsToggle').checked = visible;
  }

  function bindEvents() {
    $('keyParamsToggle').addEventListener('change', () => {
      if ($('keyParamsToggle').checked) {
        if (keyParamsUnlocked) {
          setKeyParamsVisible(true);
        } else {
          $('keyParamsToggle').checked = false;
          showPwdOverlay();
        }
      } else {
        setKeyParamsVisible(false);
      }
    });

    $('pwdCancel').addEventListener('click', () => { hidePwdOverlay(); $('keyParamsToggle').checked = false; });
    $('pwdOk').addEventListener('click', () => {
      if ($('pwdInput').value.trim().toLowerCase() === KEY_PASSWORD) {
        hidePwdOverlay();
        setKeyParamsVisible(true);
      } else {
        $('pwdError').classList.remove('hidden');
      }
    });
    $('pwdInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('pwdOk').click(); });

    $('computeP').addEventListener('input', syncFromComputeP);
    $('clusterMw').addEventListener('input', () => { syncScalePresetHighlight(); renderAll(); });

    document.querySelectorAll('.scale-preset').forEach((btn) => {
      btn.addEventListener('click', () => applyScalePreset(btn.dataset.preset));
    });

    ['pctItDevice', 'pctPowerCool'].forEach((id) => {
      $(id).addEventListener('input', () => { rebalanceProjectPct(id); renderAll(); });
    });
    $('pctLandBuild').addEventListener('input', () => { rebalanceProjectPct('pctLandBuild'); renderAll(); });

    $('ascendInItPct').addEventListener('input', () => { syncAscendNet('ascend'); renderAll(); });

    ['pue', 'elecPrice', 'utilization', 'annualFixedOpex', 'capexOpexPct', 'pctMixMiss', 'pctMixHit', 'pctMixOut', 'deprecYears', 'npuUnitPrice'].forEach((id) => {
      $(id).addEventListener('input', renderAll);
    });

    ['tpsInputMiss', 'tpsInputHit', 'tpsOutput'].forEach((id) => {
      $(id).addEventListener('input', onTpsInputChange);
    });

    ['dailyYiInputMiss', 'dailyYiInputHit', 'dailyYiOutput'].forEach((id) => {
      $(id).addEventListener('input', onDailyYiInputChange);
    });

    $('serviceModel').addEventListener('change', applyServiceModel);

    document.querySelectorAll('.cmp-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeScenario = btn.dataset.scenario;
        $('serviceModel').value = activeScenario;
        applyServiceModel();
      });
    });
    $('syncConfigBtn').addEventListener('click', syncConfigToCloud);
  }

  async function bootPage() {
    applyPageConfig();
    translateStaticLookupText();
    const [defaultsResult, cloudResult] = await Promise.all([
      AidcConfig.load(configKeys.defaults, LOCAL_ROI_DEFAULTS),
      AidcConfig.load(configKeys.cloudCompare, LOCAL_CLOUD_COMPARE),
    ]);
    configLoadMeta = { defaults: defaultsResult.source, cloud: cloudResult.source };
    mergeCloudCompare(cloudResult.data);
    applyRoiConfig(defaultsResult.data);
    activeScenario = $('serviceModel').value === 'glm-52' ? 'glm-52' : 'ds-v4';
    syncAscendNet('ascend');
    syncTpsToDailyYi();
    document.querySelectorAll('.cmp-tab').forEach((b) => {
      const on = b.dataset.scenario === activeScenario;
      b.className = 'cmp-tab rounded-xl px-4 py-2 text-sm font-semibold transition ' + (on ? 'text-blue-700 shadow-sm bg-white' : 'text-slate-600 hover:bg-white/80');
    });
    updateConfigSourceBadge();
    updatePctSumHint();
    syncScalePresetHighlight();
    renderAll();
  }

  bindEvents();
  window.AidcInvestmentRoiPage = {
    boot: bootPage,
    renderAll,
    applyPageConfig,
  };
})();
