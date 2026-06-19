/**
 * 全站 locale 联动：localStorage、postMessage、storage 事件。
 * 供 ai-dc-layout_37 等自带 i18n 的 iframe 与 ai-dc-design / index 主站同步。
 */
(function (global) {
  const STORAGE_KEY = 'aidc-locale';
  const MSG_TYPE = 'aidc-locale-change';

  function normalizeLocale(v) {
    if (v === 'en') return 'en';
    if (v === 'zh' || v === 'cn') return 'zh';
    return null;
  }

  function readFromUrl() {
    const lang = new URLSearchParams(global.location.search || '').get('lang');
    return normalizeLocale(lang);
  }

  function readStored() {
    try {
      return normalizeLocale(global.localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return null;
    }
  }

  function getLocale() {
    return readFromUrl() || readStored() || 'zh';
  }

  function setLocale(locale, options) {
    const next = normalizeLocale(locale);
    if (!next) return getLocale();
    const opts = options || {};
    const prev = readStored();
    if (prev !== next) {
      try {
        global.localStorage.setItem(STORAGE_KEY, next);
      } catch (_) {
        /* ignore */
      }
    }
    if (opts.broadcast === false) return next;

    global.dispatchEvent(
      new CustomEvent('aidc-locale-change', { detail: { locale: next, source: opts.source || 'bridge' } })
    );

    if (global.parent && global.parent !== global) {
      try {
        global.parent.postMessage({ type: MSG_TYPE, locale: next, source: opts.source || 'bridge' }, '*');
      } catch (_) {
        /* ignore */
      }
    }

    if (global.document) {
      global.document.querySelectorAll('iframe').forEach((iframe) => {
        try {
          iframe.contentWindow.postMessage({ type: MSG_TYPE, locale: next, source: opts.source || 'bridge' }, '*');
        } catch (_) {
          /* ignore */
        }
      });
    }

    return next;
  }

  function initIframeListener(onLocale, options) {
    const opts = options || {};
    const selfSource = opts.selfSource || 'iframe';

    function handle(locale, source) {
      if (source === selfSource) return;
      const next = normalizeLocale(locale);
      if (!next) return;
      if (typeof onLocale === 'function') onLocale(next, source);
    }

    global.addEventListener('aidc-locale-change', (event) => {
      handle(event.detail?.locale, event.detail?.source);
    });

    global.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      handle(event.newValue, 'storage');
    });

    global.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.type !== MSG_TYPE) return;
      handle(data.locale, data.source || 'postMessage');
    });
  }

  function toLegacyLang(locale) {
    return locale === 'en' ? 'en' : 'cn';
  }

  function fromLegacyLang(lang) {
    return lang === 'en' ? 'en' : 'zh';
  }

  function broadcastToIframes(locale, source) {
    if (!global.document) return;
    const next = normalizeLocale(locale);
    if (!next) return;
    global.document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        iframe.contentWindow.postMessage({ type: MSG_TYPE, locale: next, source: source || 'parent' }, '*');
      } catch (_) {
        /* ignore */
      }
    });
  }

  global.AidcLocaleBridge = {
    STORAGE_KEY,
    MSG_TYPE,
    getLocale,
    setLocale,
    initIframeListener,
    toLegacyLang,
    fromLegacyLang,
    broadcastToIframes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
