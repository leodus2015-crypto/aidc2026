/**
 * 机房工期和造价公式（无 DOM）。
 *
 * 口径：
 * - ICT 功耗 MW = 卡数 × 单卡功耗(kW) / 1000
 * - 机房功耗 MW = ICT MW × PUE
 * - L0+L1 = 机房 MW × 10⁶ × $/W
 * - ICT 造价 = 卡数 × $/card
 * - CAPEX = ICT + L0+L1
 * - 年 OPEX = 机房 MW × 1000 × 8760 × 电价($/kWh)
 * - OPEX = 年 OPEX × 年限
 * - 总计 = CAPEX + OPEX
 * - 静态回收期 = CAPEX 增量 ÷ 年电费节省（仅当两者均为正）
 */
(function (global) {
  'use strict';

  function parseFinite(value) {
    if (value === '' || value == null) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function validateShared(shared) {
    const source = shared || {};
    const cards = parseFinite(source.cards);
    const infraPerW = parseFinite(source.infraPerW);
    const electricity = parseFinite(source.electricity);
    const years = parseFinite(source.years);
    const errors = [];
    if (cards == null || cards < 1) errors.push('cards');
    if (infraPerW == null || infraPerW < 0) errors.push('infraPerW');
    if (electricity == null || electricity < 0) errors.push('electricity');
    if (years == null || years < 1) errors.push('years');
    return { ok: errors.length === 0, errors, values: { cards, infraPerW, electricity, years } };
  }

  function validateParameters(parameters) {
    const source = parameters || {};
    const cardPower = parseFinite(source.cardPower);
    const pue = parseFinite(source.pue);
    const unitCost = parseFinite(source.unitCost);
    const errors = [];
    if (cardPower == null || cardPower < 0) errors.push('cardPower');
    if (pue == null || pue < 1) errors.push('pue');
    if (unitCost == null || unitCost < 0) errors.push('unitCost');
    return { ok: errors.length === 0, errors, values: { cardPower, pue, unitCost } };
  }

  function calculateScenario(shared, parameters) {
    const sharedCheck = validateShared(shared);
    const paramCheck = validateParameters(parameters);
    if (!sharedCheck.ok || !paramCheck.ok) {
      return { ok: false, errors: sharedCheck.errors.concat(paramCheck.errors) };
    }
    const { cards, infraPerW, electricity, years } = sharedCheck.values;
    const { cardPower, pue, unitCost } = paramCheck.values;
    const ictMW = cards * cardPower / 1000;
    const facilityMW = ictMW * pue;
    const ictCost = cards * unitCost;
    const infraCost = facilityMW * 1e6 * infraPerW;
    const capex = ictCost + infraCost;
    const annualOpex = facilityMW * 1000 * 8760 * electricity;
    const opex = annualOpex * years;
    return {
      ok: true,
      errors: [],
      ictMW,
      facilityMW,
      ictCost,
      infraCost,
      capex,
      annualOpex,
      opex,
      total: capex + opex,
    };
  }

  function compareScenarios(air, liquid) {
    if (!air?.ok || !liquid?.ok) return { ok: false };
    const capexPremium = liquid.capex - air.capex;
    const opexSaving = air.opex - liquid.opex;
    const totalSaving = air.total - liquid.total;
    const annualSaving = air.annualOpex - liquid.annualOpex;
    const payback = capexPremium > 0 && annualSaving > 0 ? capexPremium / annualSaving : null;
    return { ok: true, capexPremium, opexSaving, totalSaving, annualSaving, payback };
  }

  const api = { parseFinite, validateShared, validateParameters, calculateScenario, compareScenarios };
  global.AidcScheduleBudget = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
