/**
 * AI DC Design 页：Tab 切换与 iframe ?lang= 同步。
 */
(function (global) {
  const TAB_ACTIVE_CLASS =
    'rounded-xl px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition bg-white';
  const TAB_INACTIVE_CLASS =
    'rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white/80 hover:text-slate-950';

  const IFRAME_BASE = {
    roomLayout: 'ai-dc-room-layout.html?embed=1',
    caseA: 'datacenter-3d-case-b.html?embed=1',
    caseB: 'datacenter-3d-v3-2.html?embed=1',
    plan: 'ai-dc-layout_37.html?embed=1',
    synergy: 'ai-dc-deployment-perf.html?embed=1',
    roi: 'aidc-investment-roi.html?embed=1',
  };

  /** iframe cache-bust; synced via data/asset-version.json + bump-asset-version.py */
  const IFRAME_ASSET_VERSION = global.AIDC_ASSET_VERSION || '5';

  function iframeSrc(key) {
    return IFRAME_BASE[key];
  }

  function withLocale(src, options) {
    if (!src) return src;
    const opts = options || {};
    const q = src.indexOf('?');
    const path = q >= 0 ? src.slice(0, q) : src;
    const params = new URLSearchParams(q >= 0 ? src.slice(q + 1) : '');
    if (global.AidcI18n?.getLocale?.() === 'en') params.set('lang', 'en');
    else params.delete('lang');
    params.set('v', IFRAME_ASSET_VERSION);
    if (opts.bust) params.set('_', String(opts.bust));
    return `${path}?${params.toString()}`;
  }

  function broadcastLocaleToIframes() {
    const locale = global.AidcI18n?.getLocale?.() || global.AidcLocaleBridge?.getLocale?.() || 'zh';
    if (global.AidcLocaleBridge?.broadcastToIframes) {
      global.AidcLocaleBridge.broadcastToIframes(locale, 'ai-dc-design');
    }
  }

  function syncIframes(options) {
    const opts = options || {};
    const bust = opts.reload ? Date.now() : null;
    Object.keys(IFRAME_BASE).forEach((key) => {
      const iframe = document.querySelector(`iframe[data-iframe-key="${key}"]`);
      if (!iframe) return;
      const nextSrc = withLocale(iframeSrc(key), { bust });
      const current = iframe.getAttribute('src') || '';
      if (!current || current !== nextSrc || opts.reload) {
        iframe.src = nextSrc;
      }
    });
    broadcastLocaleToIframes();
  }

  function initTabs() {
    const layoutTabs = Array.from(document.querySelectorAll('[data-layout-tab]')).map((tab) => ({
      id: tab.dataset.layoutTab,
      tab,
      panel: document.getElementById(tab.getAttribute('aria-controls')),
    }));

    function selectLayoutTab(mode) {
      layoutTabs.forEach(({ id, tab, panel }) => {
        const active = id === mode;
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        tab.className = active ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS;
        panel.classList.toggle('hidden', !active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
    }

    layoutTabs.forEach(({ id, tab }) => {
      tab.addEventListener('click', () => selectLayoutTab(id));
    });

    return selectLayoutTab;
  }

  function initialTabFromUrl() {
    const tab = new URLSearchParams(global.location.search).get('tab');
    return ['roomLayout', 'plan', 'synergy', 'a', 'b', 'roi'].includes(tab) ? tab : 'roomLayout';
  }

  let selectLayoutTabRef = null;

  const DESIGN_PANEL_BY_TAB = {
    roomLayout: 'panel-room-layout',
    plan: 'panel-plan',
    synergy: 'panel-synergy',
    a: 'panel-case-a',
    b: 'panel-case-b',
    roi: 'panel-roi',
  };

  function flashDesignPanel(tab) {
    const panelId = DESIGN_PANEL_BY_TAB[tab] || DESIGN_PANEL_BY_TAB.roomLayout;
    const panel = document.getElementById(panelId);
    global.AidcRefreshFlash?.pulsePanel?.(panel);
  }

  global.AidcAiDcDesignPage = {
    init() {
      selectLayoutTabRef = initTabs();
      selectLayoutTabRef(initialTabFromUrl());
      syncIframes();
    },
    navigateToTab(tab, options) {
      const mode = ['roomLayout', 'plan', 'synergy', 'a', 'b', 'roi'].includes(tab) ? tab : 'roomLayout';
      const url = new URL(global.location.href);
      url.searchParams.set('tab', mode);
      global.history.pushState({ aidcDesignTab: mode }, '', url);
      selectLayoutTabRef?.(mode);
      syncIframes(options?.reload ? { reload: true } : undefined);
      if (options?.reload) flashDesignPanel(mode);
    },
    syncIframes,
  };

  global.addEventListener('popstate', () => {
    selectLayoutTabRef?.(initialTabFromUrl());
  });
})(typeof window !== 'undefined' ? window : globalThis);
