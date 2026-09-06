(function () {
  'use strict';

  const PAGE_ID = 'ai-dc-schedule-budget';
  const model = window.AidcScheduleBudget;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const SCENE_LAYOUT = [
    {
      key: 'retrofit', index: '01', months: 5, color: '#2d7ff9',
      phases: [
        { id: 'structure', start: 0, end: 0.9, icon: '▦' },
        { id: 'power', start: 0.5, end: 2.6, icon: 'ϟ' },
        { id: 'cooling', start: 0.9, end: 3.1, icon: '❄' },
        { id: 'facility', start: 2, end: 3.8, icon: '⌁' },
        { id: 'commission', start: 3.8, end: 5, icon: '✓' },
      ],
    },
    {
      key: 'air', index: '02', months: 16, color: '#7c5cff',
      phases: [
        { id: 'civil', start: 0, end: 8, icon: '▦' },
        { id: 'power', start: 5, end: 11, icon: 'ϟ' },
        { id: 'cooling', start: 6, end: 12, icon: '❄' },
        { id: 'facility', start: 9, end: 13, icon: '⌁' },
        { id: 'commission', start: 14, end: 16, icon: '✓' },
      ],
    },
    {
      key: 'liquid', index: '03', months: 18, color: '#00a889',
      phases: [
        { id: 'civil', start: 0, end: 9, icon: '▦' },
        { id: 'power', start: 6, end: 13, icon: 'ϟ' },
        { id: 'cooling', start: 7, end: 14, icon: '◉' },
        { id: 'facility', start: 11, end: 15, icon: '⌁' },
        { id: 'commission', start: 16, end: 18, icon: '✓' },
      ],
    },
    {
      key: 'prefabricated', index: '04', months: 6, color: '#f08a36',
      phases: [
        { id: 'civil', start: 0, end: 2, icon: '▦' },
        { id: 'prefab', start: 0, end: 2, icon: '⬡' },
        { id: 'install', start: 2, end: 4.5, icon: '⌁' },
        { id: 'commission', start: 4.5, end: 5.5, icon: '◉' },
        { id: 'acceptance', start: 5.5, end: 6, icon: '✓' },
      ],
    },
  ];

  const COST_INPUTS = [
    { id: 'cost-cards', error: 'cards' },
    { id: 'cost-infra', error: 'infraPerW' },
    { id: 'cost-electricity', error: 'electricity' },
    { id: 'cost-years', error: 'years' },
    { id: 'air-card-power', error: 'cardPower' },
    { id: 'air-pue', error: 'pue' },
    { id: 'air-unit-cost', error: 'unitCost' },
    { id: 'liquid-card-power', error: 'cardPower' },
    { id: 'liquid-pue', error: 'pue' },
    { id: 'liquid-unit-cost', error: 'unitCost' },
  ];

  const SCENARIO_DEFAULTS = {
    air: { cardPower: 3, pue: 1.6, unitCost: 85000 },
    liquid: { cardPower: 2, pue: 1.2, unitCost: 110000 },
  };

  const COUNTRIES = [
    { code: 'CN', electricity: 0.098, infraPerW: 3 },
    { code: 'TH', electricity: 0.132, infraPerW: 8 },
    { code: 'MX', electricity: 0.211, infraPerW: 9.8 },
    { code: 'BR', electricity: 0.128, infraPerW: 10.1 },
    { code: 'AE', electricity: 0.11, infraPerW: 8.8 },
    { code: 'ES', electricity: 0.145, infraPerW: 9.2 },
  ];

  const app = document.getElementById('schedule-budget-app');
  const sceneSwitcher = document.getElementById('scene-switcher');
  const playButton = document.getElementById('play-timeline');
  const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  let sceneKey = 'retrofit';
  let cursor = 0;
  let playing = false;
  let animationFrame = null;
  let playStartedAt = 0;
  let initialized = false;
  let applyTimer = 0;
  const millisecondsPerMonth = 900;

  function t(key, params) {
    const value = window.AidcI18n?.t?.(key, params);
    return value && value !== key ? value : (params ? key : key);
  }

  function locale() {
    return window.AidcI18n?.getLocale?.() === 'en' ? 'en' : 'zh';
  }

  function sceneText(item, field) {
    return t(`scenes.${item.key}.${field}`);
  }

  function phaseText(item, phase, field) {
    return t(`scenes.${item.key}.phases.${phase.id}.${field}`);
  }

  function currentScene() {
    return SCENE_LAYOUT.find((item) => item.key === sceneKey) || SCENE_LAYOUT[0];
  }

  function ticks(item) {
    return Array.from({ length: item.months + 1 }, (_, index) => index);
  }

  function percentFormat() {
    return new Intl.NumberFormat(locale() === 'en' ? 'en-US' : 'zh-CN', { style: 'percent', maximumFractionDigits: 1 });
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([name, value]) => {
      if (value == null || value === false) return;
      if (name === 'className') node.className = value;
      else if (name === 'dataset') Object.assign(node.dataset, value);
      else if (name === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (name === 'text') node.textContent = value;
      else node.setAttribute(name, value === true ? '' : String(value));
    });
    (children || []).forEach((child) => {
      if (child == null) return;
      node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function stop() {
    playing = false;
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  function switchScene(key) {
    sceneKey = key;
    cursor = 0;
    stop();
    renderScene();
  }

  function togglePlay() {
    const item = currentScene();
    if (reduceMotion.matches) {
      cursor = cursor >= item.months ? 0 : item.months;
      stop();
      updatePlayback(item);
      return;
    }
    if (cursor >= item.months) cursor = 0;
    if (playing) {
      stop();
      updatePlayback(item);
      return;
    }
    playing = true;
    playStartedAt = window.performance.now() - cursor * millisecondsPerMonth;
    updatePlayback(item);

    function advance(now) {
      if (!playing) return;
      cursor = Math.min(item.months, (now - playStartedAt) / millisecondsPerMonth);
      if (cursor >= item.months) stop();
      updatePlayback(item);
      if (playing) animationFrame = window.requestAnimationFrame(advance);
    }

    animationFrame = window.requestAnimationFrame(advance);
  }

  function renderSceneSwitcher(item) {
    sceneSwitcher.replaceChildren();
    SCENE_LAYOUT.forEach((candidate) => {
      const active = candidate.key === item.key;
      const button = el('button', {
        type: 'button',
        className: active ? 'scene active' : 'scene',
        'data-scene': candidate.key,
        'aria-pressed': String(active),
        style: { '--scene-color': candidate.color },
      }, [
        el('span', { className: 'scene-index', text: candidate.index }),
        el('span', { className: 'scene-name' }, [
          el('small', { text: sceneText(candidate, 'tag') }),
          el('strong', { text: sceneText(candidate, 'name') }),
        ]),
        el('span', { className: 'scene-range', text: sceneText(candidate, 'range') }),
        el('span', { className: 'scene-line', 'aria-hidden': 'true' }, [el('i')]),
      ]);
      button.addEventListener('click', () => switchScene(candidate.key));
      sceneSwitcher.append(button);
    });
    sceneSwitcher.setAttribute('aria-label', t('copy.schemeLabel'));
  }

  function renderAxis(item) {
    const axis = document.getElementById('axis-months');
    axis.replaceChildren();
    ticks(item).forEach((tick) => {
      const mark = el('i', { style: { left: `${tick / item.months * 100}%` }, text: String(tick) });
      mark.append(el('small', { text: t('copy.monthShort') }));
      axis.append(mark);
    });
  }

  function renderPhases(item) {
    const list = document.getElementById('phase-list');
    list.replaceChildren();
    item.phases.forEach((phase, index) => {
      const grid = el('span', { className: 'track-grid' });
      ticks(item).slice(1).forEach((tick) => {
        grid.append(el('i', { style: { left: `${tick / item.months * 100}%` } }));
      });
      const bar = el('span', {
        className: 'phase-bar',
        style: {
          left: `${phase.start / item.months * 100}%`,
          width: `${(phase.end - phase.start) / item.months * 100}%`,
          animationDelay: `${index * 100}ms`,
        },
      }, [el('b', { text: phaseText(item, phase, 'work') })]);
      const row = el('div', { className: 'phase-row', dataset: { phaseIndex: String(index) } }, [
        el('div', { className: 'phase-label' }, [
          el('span', { className: 'phase-icon', text: phase.icon }),
          el('span', {}, [
            el('b', { text: phaseText(item, phase, 'name') }),
            el('small', { text: locale() === 'en' ? t('copy.workstream', { index: String(index + 1).padStart(2, '0') }) : phaseText(item, phase, 'code') }),
          ]),
          el('em', { text: phaseText(item, phase, 'duration') }),
        ]),
        el('div', { className: 'phase-track' }, [
          grid,
          bar,
          el('span', { className: 'time-cursor', 'aria-hidden': 'true' }),
        ]),
      ]);
      list.append(row);
    });
  }

  function updatePhases(item, progress) {
    document.querySelectorAll('[data-phase-index]').forEach((row) => {
      const phase = item.phases[Number(row.dataset.phaseIndex)];
      if (!phase) return;
      const complete = cursor >= phase.end;
      const current = cursor > 0 && cursor < item.months && cursor >= phase.start && cursor < phase.end;
      row.classList.toggle('complete', complete);
      row.classList.toggle('current', current);
      const timeCursor = row.querySelector('.time-cursor');
      if (!timeCursor) return;
      timeCursor.style.left = `${progress}%`;
      timeCursor.classList.toggle('visible', cursor > 0);
    });
  }

  function renderSpeaker(item) {
    const active = cursor > 0 && cursor < item.months
      ? item.phases.filter((phase) => cursor >= phase.start && cursor < phase.end)
      : [];
    setText('presenting-time', cursor === 0 ? t('copy.ready') : cursor >= item.months ? t('copy.completed') : t('copy.monthProgress', { value: cursor.toFixed(1) }));
    const work = document.getElementById('active-work');
    work.replaceChildren();
    if (active.length) {
      active.forEach((phase) => {
        work.append(el('span', {}, [
          el('i', { text: phase.icon }),
          phaseText(item, phase, 'name'),
        ]));
      });
      return;
    }
    work.append(el('span', { text: cursor >= item.months ? t('copy.allComplete') : t('copy.startHint') }));
  }

  function updatePlayback(item) {
    const progress = Math.min(100, Math.max(0, cursor / item.months * 100));
    setText('play-icon', playing ? 'Ⅱ' : '▶');
    setText('play-label', playing ? t('copy.pause') : t('copy.play'));
    playButton.setAttribute('aria-pressed', String(playing));
    updatePhases(item, progress);
    const progressFill = document.getElementById('progress-fill');
    progressFill.style.width = `${progress}%`;
    progressFill.classList.toggle('active', progress > 0);
    const progressCursor = document.getElementById('progress-cursor');
    progressCursor.style.left = `${progress}%`;
    progressCursor.style.transform = progress <= 2 ? 'translateX(0)' : progress >= 98 ? 'translateX(-100%)' : 'translateX(-50%)';
    progressCursor.textContent = t('copy.monthCursor', { value: cursor.toFixed(1) });
    renderSpeaker(item);
  }

  function renderScene() {
    const item = currentScene();
    app.style.setProperty('--accent', item.color);
    renderSceneSwitcher(item);
    setText('scene-range', sceneText(item, 'range'));
    setText('scene-index', item.index);
    setText('scene-summary', sceneText(item, 'summary'));
    const metric = item.key === 'prefabricated' ? t('scenes.prefabricated.metricLabel') : t('copy.targetDensity');
    setText('scene-density', `${metric} · ${sceneText(item, 'density')}`);
    renderAxis(item);
    renderPhases(item);
    updatePlayback(item);
  }

  function inputValue(id) {
    return document.getElementById(id)?.value;
  }

  function markValidity(id, invalid) {
    const field = document.getElementById(id);
    if (!field) return;
    if (invalid) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }

  function signedMoney(amount) {
    if (Math.abs(amount) < 0.5) return moneyFormat.format(0);
    return `${amount > 0 ? '+' : '−'}${moneyFormat.format(Math.abs(amount))}`;
  }

  function blankScenario(prefix) {
    ['ict-mw', 'facility-mw', 'infra-cost', 'ict-cost', 'capex', 'opex', 'total'].forEach((suffix) => {
      setText(`${prefix}-${suffix}`, '—');
    });
    const infraBar = document.getElementById(`${prefix}-infra-bar`);
    const ictBar = document.getElementById(`${prefix}-ict-bar`);
    if (infraBar) infraBar.style.width = '0%';
    if (ictBar) ictBar.style.width = '0%';
  }

  function renderScenario(prefix, result) {
    setText(`${prefix}-ict-mw`, `${result.ictMW.toFixed(1)} MW`);
    setText(`${prefix}-facility-mw`, `${result.facilityMW.toFixed(1)} MW`);
    setText(`${prefix}-infra-cost`, moneyFormat.format(result.infraCost));
    setText(`${prefix}-ict-cost`, moneyFormat.format(result.ictCost));
    setText(`${prefix}-capex`, moneyFormat.format(result.capex));
    setText(`${prefix}-opex`, moneyFormat.format(result.opex));
    setText(`${prefix}-total`, moneyFormat.format(result.total));
    const infraShare = result.capex > 0 ? result.infraCost / result.capex * 100 : 0;
    document.getElementById(`${prefix}-infra-bar`).style.width = `${infraShare}%`;
    document.getElementById(`${prefix}-ict-bar`).style.width = `${100 - infraShare}%`;
  }

  function renderCountryExamples() {
    const grid = document.getElementById('country-grid');
    if (!grid || !model) return;
    grid.replaceChildren();
    COUNTRIES.forEach((country) => {
      const shared = { cards: 1024, infraPerW: country.infraPerW, electricity: country.electricity, years: 5 };
      const air = model.calculateScenario(shared, SCENARIO_DEFAULTS.air);
      const liquid = model.calculateScenario(shared, SCENARIO_DEFAULTS.liquid);
      if (!air.ok || !liquid.ok) return;
      const apply = el('button', { type: 'button', dataset: { country: country.code }, text: t('copy.countryApply') });
      apply.addEventListener('click', () => {
        const preset = {
          'cost-cards': 1024,
          'cost-infra': country.infraPerW,
          'cost-electricity': country.electricity,
          'cost-years': 5,
          'air-card-power': SCENARIO_DEFAULTS.air.cardPower,
          'air-pue': SCENARIO_DEFAULTS.air.pue,
          'air-unit-cost': SCENARIO_DEFAULTS.air.unitCost,
          'liquid-card-power': SCENARIO_DEFAULTS.liquid.cardPower,
          'liquid-pue': SCENARIO_DEFAULTS.liquid.pue,
          'liquid-unit-cost': SCENARIO_DEFAULTS.liquid.unitCost,
        };
        Object.entries(preset).forEach(([id, value]) => {
          const field = document.getElementById(id);
          if (field) field.value = String(value);
        });
        renderCost();
        apply.textContent = t('copy.countryApplied');
        window.clearTimeout(applyTimer);
        applyTimer = window.setTimeout(() => {
          apply.textContent = t('copy.countryApply');
        }, 1200);
      });

      const card = el('article', { className: 'country-card' }, [
        el('div', { className: 'country-card-header' }, [
          el('span', { text: country.code }),
          el('div', {}, [
            el('h4', { text: t(`countries.${country.code}`) }),
            el('small', { text: t('copy.countryCase') }),
          ]),
          apply,
        ]),
        el('div', { className: 'country-parameters' }, [
          el('span', {}, [t('copy.countryElectricity'), el('b', { text: `$${country.electricity}/kWh` })]),
          el('span', {}, [t('copy.countryInfra'), el('b', { text: `$${country.infraPerW}/W` })]),
        ]),
        el('div', { className: 'country-scenarios' }, [
          el('div', {}, [
            el('small', { text: t('copy.countryAir') }),
            el('dl', {}, [
              el('div', {}, [el('dt', { text: t('copy.countryCapexTotal') }), el('dd', { text: moneyFormat.format(air.capex) })]),
              el('div', {}, [el('dt', { text: t('copy.countryOpexCost') }), el('dd', { text: moneyFormat.format(air.opex) })]),
              el('div', { className: 'country-total' }, [el('dt', { text: t('copy.countryOverall') }), el('dd', { text: moneyFormat.format(air.total) })]),
            ]),
          ]),
          el('div', {}, [
            el('small', { text: t('copy.countryLiquid') }),
            el('dl', {}, [
              el('div', {}, [el('dt', { text: t('copy.countryCapexTotal') }), el('dd', { text: moneyFormat.format(liquid.capex) })]),
              el('div', {}, [el('dt', { text: t('copy.countryOpexCost') }), el('dd', { text: moneyFormat.format(liquid.opex) })]),
              el('div', { className: 'country-total' }, [el('dt', { text: t('copy.countryOverall') }), el('dd', { text: moneyFormat.format(liquid.total) })]),
            ]),
          ]),
        ]),
      ]);
      grid.append(card);
    });
  }

  function renderCost() {
    if (!model) return;
    const shared = {
      cards: inputValue('cost-cards'),
      infraPerW: inputValue('cost-infra'),
      electricity: inputValue('cost-electricity'),
      years: inputValue('cost-years'),
    };
    const airParams = {
      cardPower: inputValue('air-card-power'),
      pue: inputValue('air-pue'),
      unitCost: inputValue('air-unit-cost'),
    };
    const liquidParams = {
      cardPower: inputValue('liquid-card-power'),
      pue: inputValue('liquid-pue'),
      unitCost: inputValue('liquid-unit-cost'),
    };
    const air = model.calculateScenario(shared, airParams);
    const liquid = model.calculateScenario(shared, liquidParams);
    const errors = [...new Set((air.errors || []).concat(liquid.errors || []))];

    markValidity('cost-cards', errors.includes('cards'));
    markValidity('cost-infra', errors.includes('infraPerW'));
    markValidity('cost-electricity', errors.includes('electricity'));
    markValidity('cost-years', errors.includes('years'));
    markValidity('air-card-power', !air.ok && (air.errors || []).includes('cardPower'));
    markValidity('air-pue', !air.ok && (air.errors || []).includes('pue'));
    markValidity('air-unit-cost', !air.ok && (air.errors || []).includes('unitCost'));
    markValidity('liquid-card-power', !liquid.ok && (liquid.errors || []).includes('cardPower'));
    markValidity('liquid-pue', !liquid.ok && (liquid.errors || []).includes('pue'));
    markValidity('liquid-unit-cost', !liquid.ok && (liquid.errors || []).includes('unitCost'));

    const errorBox = document.getElementById('cost-error');
    if (errors.length) {
      errorBox.hidden = false;
      errorBox.textContent = errors.map((code) => t(`errors.${code}`)).join(' ');
    } else {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    const years = Number(shared.years);
    const yearLabel = Number.isFinite(years) && years >= 1
      ? t('copy.opexYears', { years })
      : t('copy.opexYears', { years: '—' });
    setText('air-opex-label', yearLabel);
    setText('liquid-opex-label', yearLabel);
    setText('opex-saving-label', Number.isFinite(years) && years >= 1
      ? t('copy.opexYearsSaving', { years })
      : t('copy.opexYearsSaving', { years: '—' }));

    if (!air.ok) blankScenario('air');
    else renderScenario('air', air);
    if (!liquid.ok) blankScenario('liquid');
    else renderScenario('liquid', liquid);

    const compared = model.compareScenarios(air, liquid);
    if (!compared.ok) {
      ['capex-premium', 'capex-premium-rate', 'opex-saving', 'opex-saving-rate', 'total-saving', 'total-saving-rate', 'payback-years'].forEach((id) => setText(id, '—'));
      return;
    }
    const pct = percentFormat();
    setText('capex-premium', signedMoney(compared.capexPremium));
    setText('capex-premium-rate', air.capex ? `${pct.format(compared.capexPremium / air.capex)} ${t('copy.vsAir')}` : '—');
    setText('opex-saving', moneyFormat.format(Math.max(0, compared.opexSaving)));
    setText('opex-saving-rate', air.opex ? `${pct.format(compared.opexSaving / air.opex)} ${t('copy.reduction')}` : '—');
    setText('total-saving', signedMoney(compared.totalSaving));
    setText('total-saving-rate', air.total ? `${pct.format(compared.totalSaving / air.total)} ${t('copy.lifecycleLower')}` : '—');
    setText('payback-years', compared.payback == null ? '—' : t('copy.paybackYears', { value: compared.payback.toFixed(1) }));
  }

  function refreshLocale() {
    renderScene();
    renderCost();
    renderCountryExamples();
  }

  function init() {
    if (initialized) {
      refreshLocale();
      return;
    }
    initialized = true;
    playButton.addEventListener('click', togglePlay);
    window.addEventListener('pagehide', stop);
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) stop();
      updatePlayback(currentScene());
    });
    COST_INPUTS.forEach(({ id }) => {
      document.getElementById(id)?.addEventListener('input', renderCost);
    });
    renderScene();
    renderCost();
    renderCountryExamples();
  }

  window.AidcI18nBootstrap.bootstrap(PAGE_ID, {
    onReady: init,
    onLocaleChange: refreshLocale,
  });

  if (window.AidcLocaleBridge) {
    window.AidcLocaleBridge.initIframeListener((nextLocale) => {
      if (window.AidcI18n && window.AidcI18n.getLocale() !== nextLocale) {
        window.AidcI18n.setLocale(nextLocale, { page: PAGE_ID, common: true, basePath: 'i18n/' });
      }
    }, { selfSource: PAGE_ID });
  }
})();
