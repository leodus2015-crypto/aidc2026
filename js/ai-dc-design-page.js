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
    caseA: 'datacenter-3d-case-b.html',
    caseB: 'datacenter-3d-v3%202.html',
    plan: 'ai-dc-layout_37.html',
    roi: 'aidc-investment-roi.html',
  };

  function withLocale(src) {
    if (!src || global.AidcI18n?.getLocale?.() !== 'en') return src;
    const q = src.indexOf('?');
    const path = q >= 0 ? src.slice(0, q) : src;
    const params = new URLSearchParams(q >= 0 ? src.slice(q + 1) : '');
    params.set('lang', 'en');
    return `${path}?${params.toString()}`;
  }

  function broadcastLocaleToIframes() {
    const locale = global.AidcI18n?.getLocale?.() || global.AidcLocaleBridge?.getLocale?.() || 'zh';
    if (global.AidcLocaleBridge?.broadcastToIframes) {
      global.AidcLocaleBridge.broadcastToIframes(locale, 'ai-dc-design');
    }
  }

  function syncIframes() {
    Object.keys(IFRAME_BASE).forEach((key) => {
      const iframe = document.querySelector(`iframe[data-iframe-key="${key}"]`);
      if (!iframe) return;
      const nextSrc = withLocale(IFRAME_BASE[key]);
      const current = iframe.getAttribute('src') || '';
      if (!current || current.split('?')[0] !== nextSrc.split('?')[0]) {
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

  global.AidcAiDcDesignPage = {
    init() {
      const selectLayoutTab = initTabs();
      selectLayoutTab('roomLayout');
      syncIframes();
    },
    syncIframes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
