/**
 * 机房布局页：上下双 iframe，语言与父页联动。
 */
(function (global) {
  const IFRAME_BASE = {
    fourLayer: 'ai-dc-four-layer.html?embed=1',
    floorDetail: 'ai-dc-floor-detail.html?embed=1',
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
      global.AidcLocaleBridge.broadcastToIframes(locale, 'ai-dc-room-layout');
    }
  }

  function syncIframes() {
    Object.keys(IFRAME_BASE).forEach((key) => {
      const iframe = global.document.querySelector(`iframe[data-iframe-key="${key}"]`);
      if (!iframe) return;
      const nextSrc = withLocale(IFRAME_BASE[key]);
      const current = iframe.getAttribute('src') || '';
      if (!current || current.split('?')[0] !== nextSrc.split('?')[0]) {
        iframe.src = nextSrc;
      }
    });
    broadcastLocaleToIframes();
  }

  global.AidcAiDcRoomLayoutPage = {
    init() {
      syncIframes();
    },
    syncIframes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
