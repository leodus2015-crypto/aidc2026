/**
 * ROI workbook export — yellow input cells, blue formula cells matching the page.
 */
(function (global) {
  'use strict';

  const INPUT_FIELDS = [
    { id: 'computeP', type: 'n', unit: 'P', label: '算力规模（P）', note: '2026H2：1 卡 = 1P' },
    { id: 'clusterMw', type: 'n', unit: 'MW', label: '集群 IT 功率（MW）', note: '与算力规模独立输入，无公式联动' },
    { id: 'pctItDevice', type: 'n', unit: '%', label: 'IT 设备投资（%）', note: '工程投资结构（合计 100%）' },
    { id: 'pctPowerCool', type: 'n', unit: '%', label: '供电 / 散热（%）', note: '工程投资结构（合计 100%）' },
    { id: 'pctLandBuild', type: 'n', unit: '%', label: '土地 / 建筑（%）', note: '工程投资结构（合计 100%）' },
    { id: 'npuUnitPrice', type: 'n', unit: '万元/卡', label: '单卡价格（万元/卡）', note: 'P × 单卡价' },
    { id: 'ascendInItPct', type: 'n', unit: '%', label: 'IT 内 · 昇腾占比（%）', note: 'IT 设备投资 = 昇腾采购 ÷ 本占比' },
    { id: 'deprecYears', type: 'n', unit: '年', label: '设备折旧年限（年）', note: '年折旧 = 总投资 ÷ 年限' },
    { id: 'pue', type: 'n', unit: '', label: 'PUE', note: '年电费含 PUE' },
    { id: 'elecPrice', type: 'n', unit: '元/kWh', label: '工业电价（元/kWh）', note: '年电费 = MW × 1000 × 8760 × PUE × 利用率 × 电价' },
    { id: 'utilization', type: 'n', unit: '%', label: '平均利用率（%）', note: '电费与年 Token 均乘利用率' },
    { id: 'tpsInputMiss', type: 'n', unit: 't/s', label: '输入·未命中', note: '单卡吞吐（tokens/s）' },
    { id: 'tpsInputHit', type: 'n', unit: 't/s', label: '输入·命中', note: '单卡吞吐（tokens/s）' },
    { id: 'tpsOutput', type: 'n', unit: 't/s', label: '输出', note: '单卡吞吐（tokens/s）' },
    { id: 'pctMixMiss', type: 'n', unit: '%', label: '未命中成本占比', note: '三项占比合计 100%' },
    { id: 'pctMixHit', type: 'n', unit: '%', label: '命中成本占比', note: '三项占比合计 100%' },
    { id: 'pctMixOut', type: 'n', unit: '%', label: '输出成本占比', note: '三项占比合计 100%' },
    { id: 'annualFixedOpex', type: 'n', unit: '万元/年', label: '固定运维（万元/年）', note: '年运维 = 固定运维 + 年维保' },
    { id: 'capexOpexPct', type: 'n', unit: '%', label: 'CAPEX 年维保（%）', note: '年维保 = 总投资 CAPEX × 年维保（%）' },
    { id: 'serviceModel', type: 's', unit: '', label: '服务模型档位', note: '当前服务档位' },
    { id: 'refInputMiss', type: 'n', unit: '元/M', label: '对标·未命中', note: '对标公开价（元/百万 Token）' },
    { id: 'refInputHit', type: 'n', unit: '元/M', label: '对标·命中', note: '对标公开价（元/百万 Token）' },
    { id: 'refOutput', type: 'n', unit: '元/M', label: '对标·输出', note: '对标公开价（元/百万 Token）' },
  ];

  const MODEL_FORMULAS = {
    npuCount: 'ROUND(computeP,0)',
    netStorageInItPct: '100-ascendInItPct',
    ascendPct: 'ascendInItPct/100',
    itPct: 'pctItDevice/100',
    powerPct: 'pctPowerCool/100',
    landPct: 'pctLandBuild/100',
    util: 'utilization/100',
    mixMiss: 'pctMixMiss/100',
    mixHit: 'pctMixHit/100',
    mixOut: 'pctMixOut/100',
    maintRate: 'capexOpexPct/100',
    pctSum: 'pctItDevice+pctPowerCool+pctLandBuild',
    pctMixSum: 'pctMixMiss+pctMixHit+pctMixOut',
    dailyYiInputMiss: 'tpsInputMiss*86400/100000000',
    dailyYiInputHit: 'tpsInputHit*86400/100000000',
    dailyYiOutput: 'tpsOutput*86400/100000000',
    ascendCost: 'npuCount*npuUnitPrice*10000',
    itEquipment: 'IF(ascendPct>0,ascendCost/ascendPct,NA())',
    totalCapex: 'IF(itPct>0,itEquipment/itPct,NA())',
    powerCapex: 'totalCapex*powerPct',
    landCapex: 'totalCapex*landPct',
    annualMissTokens: 'npuCount*tpsInputMiss*86400*365*util',
    annualHitTokens: 'npuCount*tpsInputHit*86400*365*util',
    annualOutputTokens: 'npuCount*tpsOutput*86400*365*util',
    annualTotalTokens: 'annualMissTokens+annualHitTokens+annualOutputTokens',
    annualDep: 'totalCapex/deprecYears',
    annualPower: 'clusterMw*1000*8760*pue*util*elecPrice',
    annualMaint: 'totalCapex*maintRate',
    annualFixedOpexYuan: 'annualFixedOpex*10000',
    annualOps: 'annualFixedOpexYuan+annualMaint',
    annualOpexTotal: 'annualPower+annualOps',
    annualCost: 'annualDep+annualPower+annualOps',
    annualCostPerDay: 'annualCost/365',
    missTokensM: 'annualMissTokens/1000000',
    hitTokensM: 'annualHitTokens/1000000',
    outputTokensM: 'annualOutputTokens/1000000',
    totalTokensM: 'annualTotalTokens/1000000',
    costPerMMiss: 'IF(missTokensM>0,annualCost*mixMiss/missTokensM,NA())',
    costPerMHit: 'IF(hitTokensM>0,annualCost*mixHit/hitTokensM,NA())',
    costPerMOut: 'IF(outputTokensM>0,annualCost*mixOut/outputTokensM,NA())',
    costPerM: 'IF(outputTokensM>0,annualCost/outputTokensM,NA())',
    costPerMBlended: 'IF(totalTokensM>0,annualCost/totalTokensM,NA())',
    tpsTotal: 'tpsInputMiss+tpsInputHit+tpsOutput',
    tokenMixMiss: 'IF(tpsTotal>0,tpsInputMiss/tpsTotal,0)',
    tokenMixHit: 'IF(tpsTotal>0,tpsInputHit/tpsTotal,0)',
    tokenMixOut: 'IF(tpsTotal>0,tpsOutput/tpsTotal,0)',
    refBlended: 'tokenMixMiss*refInputMiss+tokenMixHit*refInputHit+tokenMixOut*refOutput',
    revenue: 'totalTokensM*refBlended',
    profit: 'revenue-annualCost',
    fixedCost: 'annualDep+annualOps',
    tokensBaseM: 'IF(util>0,totalTokensM/util,0)',
    powerBase: 'IF(util>0,annualPower/util,annualPower)',
    marginal: 'refBlended*tokensBaseM-powerBase',
    breakeven: 'IF(marginal>0,fixedCost/marginal,NA())',
    payback: 'IF(profit>0,totalCapex/profit,NA())',
  };

  const MODEL_ROWS = [
    { id: 'npuCount', label: 'NPU 数量', unit: '卡', note: '= P 取整', wan: false },
    { id: 'netStorageInItPct', label: 'IT 内 · 网络/存储占比（%）', unit: '%', note: '100 − 昇腾占比', wan: false },
    { id: 'pctSum', label: '工程三项合计', unit: '%', note: '三项合计 100%', wan: false },
    { id: 'pctMixSum', label: '成本占比三项合计', unit: '%', note: '三项占比合计 100%', wan: false },
    { id: 'dailyYiInputMiss', label: '输入·未命中', unit: '亿Tokens/天', note: 't/s × 86400 ÷ 10⁸', wan: false },
    { id: 'dailyYiInputHit', label: '输入·命中', unit: '亿Tokens/天', note: 't/s × 86400 ÷ 10⁸', wan: false },
    { id: 'dailyYiOutput', label: '输出', unit: '亿Tokens/天', note: 't/s × 86400 ÷ 10⁸', wan: false },
    { id: 'ascendCost', label: '昇腾采购', unit: '元', note: 'P × 单卡价', wan: true },
    { id: 'itEquipment', label: 'IT 设备投资', unit: '元', note: '昇腾采购 ÷ IT 内昇腾占比', wan: true },
    { id: 'totalCapex', label: '总投资 CAPEX', unit: '元', note: 'IT 设备 ÷ IT 工程占比', wan: true },
    { id: 'powerCapex', label: '供电/散热投资', unit: '元', note: '总投资 × 供电/散热占比', wan: true },
    { id: 'landCapex', label: '土地/建筑投资', unit: '元', note: '总投资 × 土地/建筑占比', wan: true },
    { id: 'annualMissTokens', label: '年输入·未命中', unit: 'Token', note: 'P × 未命中 t/s × 86400 × 365 × u', wan: false },
    { id: 'annualHitTokens', label: '年输入·命中', unit: 'Token', note: 'P × 命中 t/s × 86400 × 365 × u', wan: false },
    { id: 'annualOutputTokens', label: '年输出 Token', unit: 'Token', note: 'P × 输出 t/s × 86400 × 365 × u', wan: false },
    { id: 'annualTotalTokens', label: '年 Token 合计', unit: 'Token', note: '未命中 + 命中 + 输出', wan: false },
    { id: 'annualDep', label: '年折旧', unit: '元', note: '总投资 ÷ 折旧年限', wan: true },
    { id: 'annualPower', label: '年电费', unit: '元', note: 'MW × 1000 × 8760 × PUE × u × 电价', wan: true },
    { id: 'annualMaint', label: '年维保', unit: '元', note: '总投资 CAPEX × 年维保（%）', wan: true },
    { id: 'annualOps', label: '年运维（固定+维保）', unit: '元', note: '固定运维 + 年维保', wan: true },
    { id: 'annualOpexTotal', label: '年 OPEX 合计', unit: '元', note: '年电费 + 年运维', wan: true },
    { id: 'annualCost', label: '年全成本', unit: '元', note: '年折旧 + 年电费 + 年运维', wan: true },
    { id: 'annualCostPerDay', label: '年全成本/天', unit: '元/天', note: '年全成本 ÷ 365', wan: true },
    { id: 'costPerMMiss', label: '自建·未命中 / M', unit: '元', note: '年全成本 × 未命中占比 ÷ 年未命中 Token', wan: false },
    { id: 'costPerMHit', label: '自建·命中 / M', unit: '元', note: '年全成本 × 命中占比 ÷ 年命中 Token', wan: false },
    { id: 'costPerMOut', label: '自建·输出 / M', unit: '元', note: '年全成本 × 输出占比 ÷ 年输出 Token', wan: false },
    { id: 'costPerMBlended', label: '自建均摊 / M', unit: '元/M', note: '全成本 ÷ 三类 Token 合计', wan: false },
    { id: 'refBlended', label: '对标均摊价', unit: '元/M', note: '按 t/s 占比加权云价', wan: false },
    { id: 'revenue', label: '年对标收入', unit: '元', note: '年 Token 合计 / 10⁶ × 对标均摊价', wan: true },
    { id: 'profit', label: '年净利润（对标）', unit: '元', note: '对标收入 − 年全成本', wan: true },
    { id: 'breakeven', label: '盈亏平衡利用率', unit: '', note: '固定 ÷ 边际', wan: false },
    { id: 'payback', label: '静态回收期', unit: '年', note: 'CAPEX ÷ 年利润', wan: false },
  ];

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let crc = i;
      for (let k = 0; k < 8; k += 1) {
        crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      table[i] = crc >>> 0;
    }
    return table;
  }());

  function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i += 1) {
      crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(text) {
    return new TextEncoder().encode(String(text));
  }

  function u16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
  }

  function u32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return bytes;
  }

  function concat(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function dosDateTime(date) {
    return {
      date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    };
  }

  function zipStore(files, now) {
    const stamp = dosDateTime(now || new Date());
    const locals = [];
    const centrals = [];
    let offset = 0;
    files.forEach((file) => {
      const name = utf8(file.name);
      const data = file.data instanceof Uint8Array ? file.data : utf8(file.data);
      const crc = crc32(data);
      const local = concat([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0),
        u16(stamp.time), u16(stamp.date), u32(crc),
        u32(data.length), u32(data.length), u16(name.length), u16(0),
        name, data,
      ]);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0),
        u16(stamp.time), u16(stamp.date), u32(crc),
        u32(data.length), u32(data.length), u16(name.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
        name,
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    });
    const centralDir = concat(centrals);
    return concat([
      ...locals,
      centralDir,
      u32(0x06054b50), u16(0), u16(0),
      u16(files.length), u16(files.length),
      u32(centralDir.length), u32(offset), u16(0),
    ]);
  }

  function xml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function colLetter(index) {
    let n = index;
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  function ref(col, row) {
    return colLetter(col) + row;
  }

  function cellStr(address, text, style) {
    return `<c r="${address}" t="inlineStr"${style != null ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
  }

  function cellNum(address, value, style) {
    if (!Number.isFinite(value)) return cellStr(address, '', style);
    return `<c r="${address}"${style != null ? ` s="${style}"` : ''}><v>${value}</v></c>`;
  }

  function cellFormula(address, formula, cached, style) {
    const value = Number.isFinite(cached) ? `<v>${cached}</v>` : '';
    return `<c r="${address}"${style != null ? ` s="${style}"` : ''}><f>${xml(formula)}</f>${value}</c>`;
  }

  function rowXml(rowIndex, cells) {
    return `<row r="${rowIndex}">${cells.join('')}</row>`;
  }

  function sheetXml(rows, colWidths, freezeRow) {
    const lastRow = rows.length;
    const lastCol = colWidths.length;
    const cols = colWidths.map((width, i) =>
      `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('');
    const pane = freezeRow
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + pane
      + `<cols>${cols}</cols>`
      + `<sheetData>${rows.join('')}</sheetData>`
      + `<dimension ref="A1:${ref(lastCol, lastRow)}"/>`
      + '</worksheet>'
    );
  }

  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="3">'
    + '<numFmt numFmtId="164" formatCode="#,##0.00"/>'
    + '<numFmt numFmtId="165" formatCode="#,##0.0"/>'
    + '<numFmt numFmtId="166" formatCode="#,##0"/>'
    + '</numFmts>'
    + '<fonts count="4">'
    + '<font><sz val="11"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
    + '<font><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>'
    + '</fonts>'
    + '<fills count="6">'
    + '<fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>'
    + '</fills>'
    + '<borders count="2">'
    + '<border><left/><right/><top/><bottom/><diagonal/></border>'
    + '<border>'
    + '<left style="thin"><color rgb="FFE2E8F0"/></left>'
    + '<right style="thin"><color rgb="FFE2E8F0"/></right>'
    + '<top style="thin"><color rgb="FFE2E8F0"/></top>'
    + '<bottom style="thin"><color rgb="FFE2E8F0"/></bottom>'
    + '<diagonal/>'
    + '</border>'
    + '</borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="8">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'
    + '<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>'
    + '<xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>'
    + '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>'
    + '<xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>'
    + '</cellXfs>'
    + '</styleSheet>';

  const S = { base: 0, title: 1, header: 2, input: 3, formula: 4, note: 5, inputText: 6, wan: 7 };

  function t(payload, key) {
    if (typeof payload.t === 'function') return payload.t(key);
    return key;
  }

  function finiteOrBlank(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : '';
  }

  function cachedModel(id, computed, inputs) {
    if (!computed) return NaN;
    const mix = computed.tokenMix || {};
    const map = {
      npuCount: computed.npuCount,
      netStorageInItPct: inputs.ascendInItPct != null ? 100 - Number(inputs.ascendInItPct) : NaN,
      ascendPct: computed.ascendPct,
      itPct: computed.itPct,
      powerPct: computed.powerPct,
      landPct: computed.landPct,
      util: computed.utilization,
      mixMiss: Number(computed.pctMixMiss) / 100,
      mixHit: Number(computed.pctMixHit) / 100,
      mixOut: Number(computed.pctMixOut) / 100,
      maintRate: inputs.capexOpexPct != null ? Number(inputs.capexOpexPct) / 100 : NaN,
      pctSum: Number(inputs.pctItDevice) + Number(inputs.pctPowerCool) + Number(inputs.pctLandBuild),
      pctMixSum: Number(inputs.pctMixMiss) + Number(inputs.pctMixHit) + Number(inputs.pctMixOut),
      dailyYiInputMiss: Number(inputs.tpsInputMiss) * 86400 / 1e8,
      dailyYiInputHit: Number(inputs.tpsInputHit) * 86400 / 1e8,
      dailyYiOutput: Number(inputs.tpsOutput) * 86400 / 1e8,
      ascendCost: computed.ascendCost,
      itEquipment: computed.itEquipment,
      totalCapex: computed.totalCapex,
      powerCapex: computed.powerCapex,
      landCapex: computed.landCapex,
      annualMissTokens: computed.annualMissTokens,
      annualHitTokens: computed.annualHitTokens,
      annualOutputTokens: computed.annualTokens,
      annualTotalTokens: computed.annualTotalTokens,
      annualDep: computed.annualDep,
      annualPower: computed.annualPower,
      annualMaint: computed.annualMaint,
      annualFixedOpexYuan: computed.annualFixedOpexYuan,
      annualOps: computed.annualOps,
      annualOpexTotal: computed.annualPower + computed.annualOps,
      annualCost: computed.annualCost,
      annualCostPerDay: computed.annualCost / 365,
      missTokensM: computed.annualMissTokens / 1e6,
      hitTokensM: computed.annualHitTokens / 1e6,
      outputTokensM: computed.annualTokens / 1e6,
      totalTokensM: computed.annualTotalTokens / 1e6,
      costPerMMiss: computed.costPerMMiss,
      costPerMHit: computed.costPerMHit,
      costPerMOut: computed.costPerMOut,
      costPerM: computed.costPerM,
      costPerMBlended: computed.costPerMBlended,
      tpsTotal: Number(inputs.tpsInputMiss) + Number(inputs.tpsInputHit) + Number(inputs.tpsOutput),
      tokenMixMiss: mix.miss,
      tokenMixHit: mix.hit,
      tokenMixOut: mix.out,
      refBlended: computed.refBlended,
      revenue: computed.revenue,
      profit: computed.profit,
      fixedCost: computed.annualDep + computed.annualOps,
      tokensBaseM: computed.utilization > 0 ? computed.annualTotalTokens / 1e6 / computed.utilization : 0,
      powerBase: computed.utilization > 0 ? computed.annualPower / computed.utilization : computed.annualPower,
      marginal: computed.refBlended * (computed.utilization > 0 ? computed.annualTotalTokens / 1e6 / computed.utilization : 0)
        - (computed.utilization > 0 ? computed.annualPower / computed.utilization : computed.annualPower),
      breakeven: computed.breakeven,
      payback: computed.payback,
    };
    return Number(map[id]);
  }

  function buildInputsSheet(payload, nameMap) {
    const inputs = payload.inputs || {};
    const computed = payload.computed || {};
    const rows = [
      rowXml(1, [cellStr('A1', t(payload, '输入（与页面字段对应）'), S.title)]),
      rowXml(2, [cellStr('A2', t(payload, '黄色单元格为输入（可改）；蓝色单元格为公式（与页面一致）'), S.note)]),
      rowXml(3, [
        cellStr('A3', t(payload, '字段 ID'), S.header),
        cellStr('B3', t(payload, '名称'), S.header),
        cellStr('C3', t(payload, '数值'), S.header),
        cellStr('D3', t(payload, '单位'), S.header),
        cellStr('E3', t(payload, '说明'), S.header),
      ]),
    ];
    INPUT_FIELDS.forEach((field, index) => {
      const row = 4 + index;
      nameMap[field.id] = `Inputs!$C$${row}`;
      let valueCell;
      if (field.id.startsWith('ref')) {
        const key = field.id;
        valueCell = cellNum(ref(3, row), finiteOrBlank(computed[key] ?? inputs[key]), S.input);
      } else if (field.type === 's') {
        valueCell = cellStr(ref(3, row), inputs[field.id] == null ? '' : String(inputs[field.id]), S.inputText);
      } else {
        valueCell = cellNum(ref(3, row), finiteOrBlank(inputs[field.id]), S.input);
      }
      rows.push(rowXml(row, [
        cellStr(ref(1, row), field.id),
        cellStr(ref(2, row), t(payload, field.label)),
        valueCell,
        cellStr(ref(4, row), field.unit),
        cellStr(ref(5, row), t(payload, field.note), S.note),
      ]));
    });
    return sheetXml(rows, [22, 28, 16, 14, 48], 3);
  }

  function buildModelSheet(payload, nameMap) {
    const inputs = payload.inputs || {};
    const computed = payload.computed || {};
    const extraIds = Object.keys(MODEL_FORMULAS).filter((id) => !MODEL_ROWS.some((row) => row.id === id));
    const rowsSpec = MODEL_ROWS.concat(extraIds.map((id) => ({
      id,
      label: id,
      unit: '',
      note: MODEL_FORMULAS[id],
      wan: false,
      hiddenHelper: true,
    })));
    const rows = [
      rowXml(1, [cellStr('A1', t(payload, '计算（Excel 公式与页面一致）'), S.title)]),
      rowXml(2, [cellStr('A2', t(payload, '蓝色单元格为公式，改「输入」表黄色格后自动重算'), S.note)]),
      rowXml(3, [
        cellStr('A3', t(payload, '字段 ID'), S.header),
        cellStr('B3', t(payload, '指标'), S.header),
        cellStr('C3', t(payload, '数值'), S.header),
        cellStr('D3', t(payload, '单位'), S.header),
        cellStr('E3', t(payload, '万元'), S.header),
        cellStr('F3', t(payload, '公式'), S.header),
        cellStr('G3', t(payload, '说明'), S.header),
      ]),
    ];
    rowsSpec.forEach((item, index) => {
      const row = 4 + index;
      const formula = MODEL_FORMULAS[item.id];
      nameMap[item.id] = `Model!$C$${row}`;
      const cached = cachedModel(item.id, computed, inputs);
      const cells = [
        cellStr(ref(1, row), item.id),
        cellStr(ref(2, row), t(payload, item.label)),
        cellFormula(ref(3, row), formula, cached, S.formula),
        cellStr(ref(4, row), item.unit),
      ];
      if (item.wan) {
        cells.push(cellFormula(ref(5, row), `${ref(3, row)}/10000`, Number.isFinite(cached) ? cached / 10000 : NaN, S.wan));
      } else {
        cells.push(cellStr(ref(5, row), ''));
      }
      cells.push(cellStr(ref(6, row), formula, S.note));
      cells.push(cellStr(ref(7, row), t(payload, item.note), S.note));
      rows.push(rowXml(row, cells));
    });
    return sheetXml(rows, [22, 28, 18, 12, 12, 56, 40], 3);
  }

  function scenarioKeys(cloudCompare) {
    return Object.keys(cloudCompare || {}).filter((key) => key !== 'schemaVersion' && cloudCompare[key] && Array.isArray(cloudCompare[key].clouds));
  }

  function buildCloudSheet(payload) {
    const cloudCompare = payload.cloudCompare || {};
    const keys = scenarioKeys(cloudCompare);
    const rows = [
      rowXml(1, [cellStr('A1', t(payload, '云公开价'), S.title)]),
      rowXml(2, [cellStr('A2', t(payload, '可在本表改价；自建成本引用计算表'), S.note)]),
    ];
    let row = 4;
    keys.forEach((key) => {
      const sc = cloudCompare[key];
      const active = key === payload.activeScenario ? ` · ${t(payload, '当前服务档位')}` : '';
      rows.push(rowXml(row, [cellStr(ref(1, row), `${t(payload, sc.title || key)}${active}`, S.title)]));
      row += 1;
      if (sc.pricingNote) {
        rows.push(rowXml(row, [cellStr(ref(1, row), t(payload, sc.pricingNote), S.note)]));
        row += 1;
      }
      rows.push(rowXml(row, [
        cellStr(ref(1, row), t(payload, '平台'), S.header),
        cellStr(ref(2, row), t(payload, '输入·未命中'), S.header),
        cellStr(ref(3, row), t(payload, '输入·命中'), S.header),
        cellStr(ref(4, row), t(payload, '输出'), S.header),
        cellStr(ref(5, row), t(payload, '低于自建'), S.header),
        cellStr(ref(6, row), t(payload, '低于自建'), S.header),
        cellStr(ref(7, row), t(payload, '低于自建'), S.header),
      ]));
      row += 1;
      (sc.clouds || []).forEach((cloud) => {
        const missRef = ref(2, row);
        const hitRef = ref(3, row);
        const outRef = ref(4, row);
        rows.push(rowXml(row, [
          cellStr(ref(1, row), t(payload, cloud.name || '')),
          cellNum(missRef, finiteOrBlank(cloud.inputMiss), S.input),
          cellNum(hitRef, finiteOrBlank(cloud.inputHit), S.input),
          cellNum(outRef, finiteOrBlank(cloud.output), S.input),
          cellFormula(ref(5, row), `IF(${missRef}<costPerMMiss,"${t(payload, '低于自建')}","${t(payload, '高于自建')}")`, NaN, S.formula),
          cellFormula(ref(6, row), `IF(${hitRef}<costPerMHit,"${t(payload, '低于自建')}","${t(payload, '高于自建')}")`, NaN, S.formula),
          cellFormula(ref(7, row), `IF(${outRef}<costPerMOut,"${t(payload, '低于自建')}","${t(payload, '高于自建')}")`, NaN, S.formula),
        ]));
        row += 1;
      });
      row += 1;
    });
    return sheetXml(rows, [22, 16, 16, 16, 16, 16, 16], 2);
  }

  function definedNamesXml(nameMap) {
    const names = Object.keys(nameMap).sort().map((name) =>
      `<definedName name="${xml(name)}">${xml(nameMap[name])}</definedName>`).join('');
    return `<definedNames>${names}</definedNames>`;
  }

  function workbookXml(nameMap) {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<workbookPr/>'
      + '<calcPr calcId="191028" fullCalcOnLoad="1"/>'
      + '<sheets>'
      + '<sheet name="Inputs" sheetId="1" r:id="rId1"/>'
      + '<sheet name="Model" sheetId="2" r:id="rId2"/>'
      + '<sheet name="Cloud" sheetId="3" r:id="rId3"/>'
      + '</sheets>'
      + definedNamesXml(nameMap)
      + '</workbook>'
    );
  }

  function contentTypesXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      + '</Types>'
    );
  }

  function relsXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
      + '</Relationships>'
    );
  }

  function workbookRelsXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>'
      + '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '</Relationships>'
    );
  }

  function coreXml() {
    const now = new Date().toISOString();
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
      + ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
      + ' xmlns:dcterms="http://purl.org/dc/terms/"'
      + ' xmlns:dcmitype="http://purl.org/dc/dcmitype/"'
      + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + '<dc:title>AIDC Token ROI</dc:title>'
      + '<dc:creator>AIDC 2026</dc:creator>'
      + `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`
      + `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`
      + '</cp:coreProperties>'
    );
  }

  function appXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
      + '<Application>AIDC 2026</Application>'
      + '<HeadingPairs><vt:vector xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes" size="2" baseType="variant">'
      + '<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>3</vt:i4></vt:variant>'
      + '</vt:vector></HeadingPairs>'
      + '<TitlesOfParts><vt:vector xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes" size="3" baseType="lpstr">'
      + '<vt:lpstr>Inputs</vt:lpstr><vt:lpstr>Model</vt:lpstr><vt:lpstr>Cloud</vt:lpstr>'
      + '</vt:vector></TitlesOfParts>'
      + '</Properties>'
    );
  }

  function buildFiles(payload) {
    const nameMap = {};
    const inputsXml = buildInputsSheet(payload, nameMap);
    const modelXml = buildModelSheet(payload, nameMap);
    const cloudXml = buildCloudSheet(payload);
    return [
      { name: '[Content_Types].xml', data: contentTypesXml() },
      { name: '_rels/.rels', data: relsXml() },
      { name: 'docProps/core.xml', data: coreXml() },
      { name: 'docProps/app.xml', data: appXml() },
      { name: 'xl/workbook.xml', data: workbookXml(nameMap) },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml() },
      { name: 'xl/styles.xml', data: STYLES_XML },
      { name: 'xl/worksheets/sheet1.xml', data: inputsXml },
      { name: 'xl/worksheets/sheet2.xml', data: modelXml },
      { name: 'xl/worksheets/sheet3.xml', data: cloudXml },
    ];
  }

  function buildWorkbook(payload) {
    return zipStore(buildFiles(payload || {}));
  }

  function download(payload) {
    const bytes = buildWorkbook(payload);
    const locale = payload && payload.locale === 'en' ? 'en' : 'zh';
    const name = locale === 'en' ? 'AIDC-Token-ROI.xlsx' : 'AIDC-Token-ROI.xlsx';
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return bytes;
  }

  global.AidcInvestmentRoiXlsx = {
    INPUT_FIELDS,
    MODEL_FORMULAS,
    MODEL_ROWS,
    buildFiles,
    buildWorkbook,
    download,
  };
}(typeof window !== 'undefined' ? window : globalThis));
