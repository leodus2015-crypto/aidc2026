/**
 * Compute-est workbook export — yellow inputs, blue formulas matching the page.
 */
(function (global) {
  'use strict';

  const INPUT_FIELDS = [
    { id: 'inTokens', unitKey: 'xlsx_unit_token', labelKey: 'lbl_inTokens', noteKey: 'xlsx_note_inTokens' },
    { id: 'outTokens', unitKey: 'xlsx_unit_token', labelKey: 'lbl_outTokens', noteKey: 'xlsx_note_outTokens' },
    { id: 'cacheHitRate', unitKey: 'xlsx_unit_pct', labelKey: 'lbl_cacheHitRate', noteKey: 'xlsx_note_cache' },
    { id: 'dau', unitKey: 'xlsx_unit_people', labelKey: 'lbl_dau', noteKey: 'xlsx_note_dau' },
    { id: 'currentPenetration', unitKey: 'xlsx_unit_pct', labelKey: 'lbl_currentPenetration', noteKey: 'xlsx_note_pen0' },
    { id: 'futurePenetration', unitKey: 'xlsx_unit_pct', labelKey: 'lbl_futurePenetration', noteKey: 'xlsx_note_penN' },
    { id: 'activeParams', unitKey: 'xlsx_unit_bparams', labelKey: 'lbl_activeParams', noteKey: 'xlsx_note_pact' },
    { id: 'totalParams', unitKey: 'xlsx_unit_bparams', labelKey: 'lbl_totalParams', noteKey: 'xlsx_note_ptotal' },
    { id: 'flopsMultiplier', unitKey: '', labelKey: 'lbl_flopsMultiplier', noteKey: 'xlsx_note_flops' },
    { id: 'peakMultiplier', unitKey: 'xlsx_unit_times', labelKey: 'lbl_peakMultiplier', noteKey: 'xlsx_note_peak' },
    { id: 'utilization', unitKey: 'xlsx_unit_pct', labelKey: 'lbl_utilization', noteKey: 'xlsx_note_util' },
    { id: 'computeMargin', unitKey: 'xlsx_unit_times', labelKey: 'lbl_computeMargin', noteKey: 'xlsx_note_margin' },
    { id: 'years', unitKey: 'xlsx_unit_year', labelKey: 'lbl_years', noteKey: 'xlsx_note_years' },
    { id: 'frequencyFactor', unitKey: 'xlsx_unit_times', labelKey: 'lbl_frequencyFactor', noteKey: 'xlsx_note_freq' },
    { id: 'agentFactor', unitKey: 'xlsx_unit_times', labelKey: 'lbl_agentFactor', noteKey: 'xlsx_note_agent' },
    { id: 'cardTflops', unitKey: 'xlsx_unit_tflops', labelKey: 'lbl_cardTflops', noteKey: 'xlsx_note_card' },
    { id: 'cardsPerDevice', unitKey: 'xlsx_unit_cards_dev', labelKey: 'lbl_cardsPerDevice', noteKey: 'xlsx_note_qunit' },
    { id: 'cardVram', unitKey: 'xlsx_unit_gb', labelKey: 'lbl_cardVram', noteKey: 'xlsx_note_vram' },
    { id: 'weightPrecision', unitKey: 'xlsx_unit_bparam', labelKey: 'xlsx_lbl_precision', noteKey: 'xlsx_note_bw' },
    { id: 'vramUsable', unitKey: 'xlsx_unit_pct', labelKey: 'lbl_vramUsable', noteKey: 'xlsx_note_eta' },
  ];

  const MODEL_FORMULAS = {
    activeUsers: 'dau*currentPenetration/100',
    perUserTokens: 'outTokens+inTokens*(1-cacheHitRate/100)',
    dailyTokensRaw: 'activeUsers*perUserTokens',
    tokenPerSecond: 'dailyTokensRaw/86400',
    util: 'utilization/100',
    baseFlops: 'tokenPerSecond*flopsMultiplier*(activeParams*1000000000)*peakMultiplier/util',
    basePflops: 'baseFlops/1E15',
    plannedPflops: 'basePflops*computeMargin',
    cardFlops: 'cardTflops*1E12',
    baseCards: 'CEILING(baseFlops/cardFlops,1)',
    computeCards: 'CEILING(plannedPflops*1E15/cardFlops,1)',
    weightBytes: 'totalParams*1000000000*weightPrecision',
    usableBytesPerCard: 'cardVram*1073741824*(vramUsable/100)',
    minCards: 'CEILING(weightBytes/usableBytesPerCard,1)',
    currentCards: 'MAX(computeCards,minCards)',
    currentDevices: 'CEILING(currentCards/cardsPerDevice,1)',
    penetrationFactor: 'futurePenetration/currentPenetration',
    growthMultiple: 'penetrationFactor*frequencyFactor*agentFactor',
    futurePflops: 'plannedPflops*growthMultiple',
    futureCards: 'MAX(CEILING(futurePflops*1E15/cardFlops,1),minCards)',
    futureActiveUsers: 'dau*futurePenetration/100',
  };

  const MODEL_ROWS = [
    { id: 'activeUsers', labelKey: 'xlsx_metric_activeUsers', unitKey: 'xlsx_unit_people', noteKey: 'xlsx_note_activeUsers' },
    { id: 'perUserTokens', labelKey: 'xlsx_metric_perUser', unitKey: 'unit_per_user', noteKey: 'xlsx_note_perUser' },
    { id: 'dailyTokensRaw', labelKey: 'xlsx_metric_daily', unitKey: 'xlsx_unit_token', noteKey: 'xlsx_note_daily' },
    { id: 'tokenPerSecond', labelKey: 'xlsx_metric_tps', unitKey: 'xlsx_unit_tps', noteKey: 'xlsx_note_tps' },
    { id: 'basePflops', labelKey: 'xlsx_metric_basePflops', unitKey: 'xlsx_unit_pflops', noteKey: 'xlsx_note_basePflops' },
    { id: 'plannedPflops', labelKey: 'xlsx_metric_plannedPflops', unitKey: 'xlsx_unit_pflops', noteKey: 'xlsx_note_plannedPflops' },
    { id: 'baseCards', labelKey: 'xlsx_metric_baseCards', unitKey: 'unit_card', noteKey: 'xlsx_note_baseCards' },
    { id: 'computeCards', labelKey: 'xlsx_metric_computeCards', unitKey: 'unit_card', noteKey: 'xlsx_note_computeCards' },
    { id: 'minCards', labelKey: 'xlsx_metric_minCards', unitKey: 'unit_card', noteKey: 'xlsx_note_minCards' },
    { id: 'currentCards', labelKey: 'xlsx_metric_currentCards', unitKey: 'unit_card', noteKey: 'xlsx_note_currentCards' },
    { id: 'currentDevices', labelKey: 'xlsx_metric_devices', unitKey: 'unit_server', noteKey: 'xlsx_note_devices' },
    { id: 'penetrationFactor', labelKey: 'xlsx_metric_penFactor', unitKey: 'xlsx_unit_times', noteKey: 'xlsx_note_penFactor' },
    { id: 'growthMultiple', labelKey: 'xlsx_metric_growth', unitKey: 'xlsx_unit_times', noteKey: 'xlsx_note_growth' },
    { id: 'futurePflops', labelKey: 'xlsx_metric_futurePflops', unitKey: 'xlsx_unit_pflops', noteKey: 'xlsx_note_futurePflops' },
    { id: 'futureCards', labelKey: 'xlsx_metric_futureCards', unitKey: 'unit_card', noteKey: 'xlsx_note_futureCards' },
    { id: 'futureActiveUsers', labelKey: 'xlsx_metric_futureUsers', unitKey: 'xlsx_unit_people', noteKey: 'xlsx_note_futureUsers' },
  ];

  const HIDDEN_HELPERS = ['util', 'baseFlops', 'cardFlops', 'weightBytes', 'usableBytesPerCard'];

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
        u32(0x04034b50), u16(20), u16(0), u16(0),
        u16(stamp.time), u16(stamp.date), u32(crc),
        u32(data.length), u32(data.length), u16(name.length), u16(0),
        name, data,
      ]);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0),
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
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function xmlFormula(text) {
    return String(text)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
    return `<c r="${address}"${style != null ? ` s="${style}"` : ''}><f>${xmlFormula(formula)}</f>${value}</c>`;
  }

  function rowXml(rowIndex, cells, hidden) {
    return `<row r="${rowIndex}"${hidden ? ' hidden="1"' : ''}>${cells.join('')}</row>`;
  }

  function sheetXml(rows, colWidths, freezeRow) {
    const lastRow = rows.reduce((max, xmlText) => {
      const match = /<row r="(\d+)"/.exec(xmlText);
      const n = match ? Number(match[1]) : 0;
      return n > max ? n : max;
    }, rows.length);
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
      + `<dimension ref="A1:${ref(lastCol, lastRow)}"/>`
      + pane
      + `<cols>${cols}</cols>`
      + `<sheetData>${rows.join('')}</sheetData>`
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
    if (key == null || key === '') return '';
    if (typeof payload.t === 'function') return payload.t(key);
    return key;
  }

  function isEn(payload) {
    return !!(payload && payload.locale === 'en');
  }

  function sheetNames(payload) {
    if (isEn(payload)) {
      return {
        inputs: t(payload, 'xlsx_sheet_inputs') || 'Inputs',
        model: t(payload, 'xlsx_sheet_model') || 'Model',
        years: t(payload, 'xlsx_sheet_years') || 'Years',
      };
    }
    return { inputs: '输入', model: '计算', years: '逐年' };
  }

  function quoteSheet(name) {
    const text = String(name || '');
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) return text;
    return `'${text.replace(/'/g, "''")}'`;
  }

  function sheetCell(sheetName, col, row) {
    return `${quoteSheet(sheetName)}!$${colLetter(col)}$${row}`;
  }

  function finiteOrBlank(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : '';
  }

  function cachedModel(id, computed) {
    if (!computed) return NaN;
    const map = {
      activeUsers: computed.activeUsers,
      perUserTokens: computed.perUserTokens,
      dailyTokensRaw: computed.dailyTokensRaw,
      tokenPerSecond: computed.tokenPerSecond,
      util: computed.v ? Number(computed.v.utilization) / 100 : NaN,
      baseFlops: Number.isFinite(computed.basePflops) ? computed.basePflops * 1e15 : NaN,
      basePflops: computed.basePflops,
      plannedPflops: computed.plannedPflops,
      cardFlops: computed.v ? Number(computed.v.cardTflops) * 1e12 : NaN,
      baseCards: computed.baseCards,
      computeCards: computed.computeCards,
      weightBytes: computed.v
        ? Number(computed.v.totalParams) * 1e9 * Number(computed.v.weightPrecision)
        : NaN,
      usableBytesPerCard: computed.v
        ? Number(computed.v.cardVram) * (1024 ** 3) * (Number(computed.v.vramUsable) / 100)
        : NaN,
      minCards: computed.minCards,
      currentCards: computed.currentCards,
      currentDevices: computed.currentDevices,
      penetrationFactor: computed.penetrationFactor,
      growthMultiple: computed.growthMultiple,
      futurePflops: computed.futurePflops,
      futureCards: computed.futureCards,
      futureActiveUsers: computed.futureActiveUsers,
    };
    return Number(map[id]);
  }

  function buildInputsSheet(payload, nameMap, sheets) {
    const inputs = payload.inputs || {};
    const rows = [
      rowXml(1, [cellStr('A1', t(payload, 'xlsx_title_inputs'), S.title)]),
      rowXml(2, [cellStr('A2', t(payload, 'xlsx_hint_inputs'), S.note)]),
      rowXml(3, [
        cellStr('A3', t(payload, 'xlsx_col_name'), S.header),
        cellStr('B3', t(payload, 'xlsx_col_value'), S.header),
        cellStr('C3', t(payload, 'xlsx_col_unit'), S.header),
        cellStr('D3', t(payload, 'xlsx_col_note'), S.header),
      ]),
    ];
    INPUT_FIELDS.forEach((field, index) => {
      const row = 4 + index;
      nameMap[field.id] = sheetCell(sheets.inputs, 2, row);
      rows.push(rowXml(row, [
        cellStr(ref(1, row), t(payload, field.labelKey)),
        cellNum(ref(2, row), finiteOrBlank(inputs[field.id]), S.input),
        cellStr(ref(3, row), t(payload, field.unitKey)),
        cellStr(ref(4, row), t(payload, field.noteKey), S.note),
      ]));
    });
    return sheetXml(rows, [28, 16, 14, 48], 3);
  }

  function buildModelSheet(payload, nameMap, sheets) {
    const computed = payload.computed || {};
    const extraIds = HIDDEN_HELPERS.filter((id) => !MODEL_ROWS.some((row) => row.id === id));
    const rowsSpec = MODEL_ROWS.concat(extraIds.map((id) => ({
      id,
      labelKey: '',
      unitKey: '',
      noteKey: '',
      hiddenHelper: true,
    })));
    const rows = [
      rowXml(1, [cellStr('A1', t(payload, 'xlsx_title_model'), S.title)]),
      rowXml(2, [cellStr('A2', t(payload, 'xlsx_hint_model'), S.note)]),
      rowXml(3, [
        cellStr('A3', t(payload, 'xlsx_col_metric'), S.header),
        cellStr('B3', t(payload, 'xlsx_col_value'), S.header),
        cellStr('C3', t(payload, 'xlsx_col_unit'), S.header),
        cellStr('D3', t(payload, 'xlsx_col_note'), S.header),
      ]),
    ];
    rowsSpec.forEach((item, index) => {
      const row = 4 + index;
      const formula = MODEL_FORMULAS[item.id];
      nameMap[item.id] = sheetCell(sheets.model, 2, row);
      const cached = cachedModel(item.id, computed);
      rows.push(rowXml(row, [
        cellStr(ref(1, row), item.hiddenHelper ? '' : t(payload, item.labelKey)),
        cellFormula(ref(2, row), formula, cached, S.formula),
        cellStr(ref(3, row), item.hiddenHelper ? '' : t(payload, item.unitKey)),
        cellStr(ref(4, row), item.hiddenHelper ? '' : t(payload, item.noteKey), S.note),
      ], item.hiddenHelper));
    });
    return sheetXml(rows, [28, 18, 14, 48], 3);
  }

  function yearCount(payload) {
    const n = Number(payload.inputs && payload.inputs.years);
    if (!Number.isInteger(n) || n < 1) return 5;
    return Math.min(20, n);
  }

  function buildYearsSheet(payload) {
    const computed = payload.computed || {};
    const years = yearCount(payload);
    const calendarYear = Number(payload.calendarYear) || new Date().getFullYear();
    const yearRows = Array.isArray(computed.years) ? computed.years : [];
    const rows = [
      rowXml(1, [cellStr('A1', t(payload, 'xlsx_title_years'), S.title)]),
      rowXml(2, [cellStr('A2', t(payload, 'xlsx_hint_years'), S.note)]),
      rowXml(3, [
        cellStr('A3', t(payload, 'xlsx_col_year'), S.header),
        cellStr('B3', t(payload, 'xlsx_col_penetration'), S.header),
        cellStr('C3', t(payload, 'xlsx_col_freq'), S.header),
        cellStr('D3', t(payload, 'xlsx_col_agent'), S.header),
        cellStr('E3', t(payload, 'xlsx_col_total'), S.header),
        cellStr('F3', t(payload, 'xlsx_col_pflops'), S.header),
        cellStr('G3', t(payload, 'xlsx_col_cards'), S.header),
        cellStr('H3', t(payload, 'xlsx_col_servers'), S.header),
      ]),
    ];
    for (let year = 0; year <= years; year += 1) {
      const row = 4 + year;
      const cached = yearRows[year] || {};
      const progress = `IF(years=0,0,${year}/years)`;
      const penF = `currentPenetration+(futurePenetration-currentPenetration)*${progress}`;
      const kFreq = `POWER(frequencyFactor,${progress})`;
      const kAgent = `POWER(agentFactor,${progress})`;
      const total = `(${penF})/currentPenetration*(${kFreq})*(${kAgent})`;
      const pflops = `plannedPflops*(${total})`;
      const rawCards = `CEILING((${pflops})*1E15/cardFlops,1)`;
      const cards = `MAX(${rawCards},minCards)`;
      const devices = `CEILING((${cards})/cardsPerDevice,1)`;
      const label = year === 0
        ? `${calendarYear}${t(payload, 'yr_current_suffix')}`
        : String(calendarYear + year);
      rows.push(rowXml(row, [
        cellStr(ref(1, row), label),
        cellFormula(ref(2, row), penF, cached.penetration, S.formula),
        cellFormula(ref(3, row), kFreq, cached.kFrequency, S.formula),
        cellFormula(ref(4, row), kAgent, cached.kAgent, S.formula),
        cellFormula(ref(5, row), total, cached.total, S.formula),
        cellFormula(ref(6, row), pflops, cached.pflops, S.formula),
        cellFormula(ref(7, row), cards, cached.cards, S.formula),
        cellFormula(ref(8, row), devices, cached.devices, S.formula),
      ]));
    }
    return sheetXml(rows, [16, 12, 12, 12, 12, 16, 12, 12], 3);
  }

  function definedNamesXml(nameMap) {
    const names = Object.keys(nameMap).sort().map((name) =>
      `<definedName name="${xml(name)}">${xml(nameMap[name])}</definedName>`).join('');
    return `<definedNames>${names}</definedNames>`;
  }

  function workbookXml(nameMap, sheets) {
    const names = sheets || { inputs: '输入', model: '计算', years: '逐年' };
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<workbookPr/>'
      + '<bookViews><workbookView/></bookViews>'
      + '<sheets>'
      + `<sheet name="${xml(names.inputs)}" sheetId="1" r:id="rId1"/>`
      + `<sheet name="${xml(names.model)}" sheetId="2" r:id="rId2"/>`
      + `<sheet name="${xml(names.years)}" sheetId="3" r:id="rId3"/>`
      + '</sheets>'
      + definedNamesXml(nameMap)
      + '<calcPr calcId="191028" fullCalcOnLoad="1"/>'
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

  function coreXml(payload) {
    const now = new Date().toISOString();
    const title = isEn(payload) ? 'AIDC Compute Estimation' : 'AIDC 算力估算';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
      + ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
      + ' xmlns:dcterms="http://purl.org/dc/terms/"'
      + ' xmlns:dcmitype="http://purl.org/dc/dcmitype/"'
      + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + `<dc:title>${xml(title)}</dc:title>`
      + '<dc:creator>AIDC 2026</dc:creator>'
      + `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`
      + `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`
      + '</cp:coreProperties>'
    );
  }

  function appXml(payload, sheets) {
    const heading = isEn(payload) ? 'Worksheets' : '工作表';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
      + '<Application>AIDC 2026</Application>'
      + '<HeadingPairs><vt:vector xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes" size="2" baseType="variant">'
      + `<vt:variant><vt:lpstr>${xml(heading)}</vt:lpstr></vt:variant><vt:variant><vt:i4>3</vt:i4></vt:variant>`
      + '</vt:vector></HeadingPairs>'
      + '<TitlesOfParts><vt:vector xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes" size="3" baseType="lpstr">'
      + `<vt:lpstr>${xml(sheets.inputs)}</vt:lpstr><vt:lpstr>${xml(sheets.model)}</vt:lpstr><vt:lpstr>${xml(sheets.years)}</vt:lpstr>`
      + '</vt:vector></TitlesOfParts>'
      + '</Properties>'
    );
  }

  function buildFiles(payload) {
    const data = payload || {};
    const sheets = sheetNames(data);
    const nameMap = {};
    const inputsXml = buildInputsSheet(data, nameMap, sheets);
    const modelXml = buildModelSheet(data, nameMap, sheets);
    const yearsXml = buildYearsSheet(data);
    return [
      { name: '[Content_Types].xml', data: contentTypesXml() },
      { name: '_rels/.rels', data: relsXml() },
      { name: 'docProps/core.xml', data: coreXml(data) },
      { name: 'docProps/app.xml', data: appXml(data, sheets) },
      { name: 'xl/workbook.xml', data: workbookXml(nameMap, sheets) },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml() },
      { name: 'xl/styles.xml', data: STYLES_XML },
      { name: 'xl/worksheets/sheet1.xml', data: inputsXml },
      { name: 'xl/worksheets/sheet2.xml', data: modelXml },
      { name: 'xl/worksheets/sheet3.xml', data: yearsXml },
    ];
  }

  function buildWorkbook(payload) {
    return zipStore(buildFiles(payload || {}));
  }

  function download(payload) {
    const bytes = buildWorkbook(payload);
    const locale = payload && payload.locale === 'en' ? 'en' : 'zh';
    const name = locale === 'en' ? 'AIDC-Compute-Est.xlsx' : 'AIDC-算力估算.xlsx';
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

  global.AidcComputeEstXlsx = {
    INPUT_FIELDS,
    MODEL_FORMULAS,
    MODEL_ROWS,
    buildFiles,
    buildWorkbook,
    download,
  };
}(typeof window !== 'undefined' ? window : globalThis));
