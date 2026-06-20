/**
 * 单页 i18n：从 i18n/*.json 加载文案，支持 data-i18n 与 t(key, params)。
 */
(function (global) {
  const STORAGE_KEY = 'aidc-locale';
  const DEFAULT_LOCALE = 'zh';
  /** Bump when i18n JSON content changes to avoid stale browser cache. */
  const BUNDLE_VERSION = '4';

  let locale = DEFAULT_LOCALE;
  let messages = {};
  let active = false;
  let pageId = null;

  function resolvePath(obj, key) {
    if (!obj || !key) return undefined;
    const parts = key.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length; i += 1) {
      cur = cur?.[parts[i]];
      if (cur === undefined) return undefined;
    }
    return cur;
  }

  function interpolate(text, params) {
    if (!params || typeof text !== 'string') return text;
    return text.replace(/\{(\w+)\}/g, (_, name) => {
      if (Object.prototype.hasOwnProperty.call(params, name)) {
        const val = params[name];
        return val == null ? '' : String(val);
      }
      return `{${name}}`;
    });
  }

  function t(key, params) {
    const raw = resolvePath(messages, key);
    if (raw == null) return key;
    if (typeof raw === 'string') return interpolate(raw, params);
    return key;
  }

  async function loadJson(url) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}v=${BUNDLE_VERSION}`);
    if (!res.ok) throw new Error(`i18n load failed: ${url} (${res.status})`);
    return res.json();
  }

  function deepMerge(target, source) {
    const out = { ...target };
    Object.keys(source || {}).forEach((k) => {
      if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = deepMerge(out[k] || {}, source[k]);
      } else {
        out[k] = source[k];
      }
    });
    return out;
  }

  let initOptions = { page: null, common: true, basePath: 'i18n/' };

  function detectInitialLocale() {
    const params = new URLSearchParams(global.location.search || '');
    const fromUrl = params.get('lang');
    if (fromUrl === 'zh' || fromUrl === 'en') {
      try {
        global.localStorage?.setItem(STORAGE_KEY, fromUrl);
      } catch (_) {
        /* ignore */
      }
      return fromUrl;
    }
    const stored = global.localStorage?.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
    const lang = (global.navigator?.language || '').toLowerCase();
    if (lang.startsWith('en')) return 'en';
    return DEFAULT_LOCALE;
  }

  function applyMeta() {
    const title = t('meta.title');
    if (title && title !== 'meta.title') document.title = title;
    const descEl = document.querySelector('meta[name="description"]');
    const desc = t('meta.description');
    if (descEl && desc && desc !== 'meta.description') descEl.setAttribute('content', desc);
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }

  function applyDom(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (key) el.setAttribute('aria-label', t(key));
    });
    scope.querySelectorAll('[data-i18n-download]').forEach((el) => {
      const key = el.getAttribute('data-i18n-download');
      if (key) el.setAttribute('download', t(key));
    });
    scope.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const key = el.getAttribute('data-i18n-alt');
      if (key) el.setAttribute('alt', t(key));
    });
  }

  async function loadBundles(nextLocale, options) {
    const base = options.basePath || 'i18n/';
    const common = options.common ? await loadJson(`${base}common.${nextLocale}.json`) : {};
    const page = options.page ? await loadJson(`${base}${options.page}.${nextLocale}.json`) : {};
    return deepMerge(common, page);
  }

  async function init(options) {
    initOptions = {
      page: options.page || null,
      common: options.common !== false,
      basePath: options.basePath || 'i18n/',
    };
    pageId = initOptions.page;
    locale = options.locale || detectInitialLocale();
    messages = await loadBundles(locale, initOptions);
    active = true;
    applyMeta();
    return locale;
  }

  async function setLocale(nextLocale, options) {
    if (nextLocale !== 'zh' && nextLocale !== 'en') return locale;
    locale = nextLocale;
    try {
      global.localStorage?.setItem(STORAGE_KEY, locale);
    } catch (_) {
      /* ignore */
    }
    const bundleOptions = options || initOptions;
    messages = await loadBundles(locale, bundleOptions);
    applyMeta();
    applyDom();
    if (typeof global.__aidcI18nAfterLocaleChange === 'function') {
      global.__aidcI18nAfterLocaleChange(locale);
    }
    if (global.AidcLocaleBridge?.broadcastToIframes) {
      global.AidcLocaleBridge.broadcastToIframes(locale, 'i18n');
    }
    global.dispatchEvent(new CustomEvent('aidc-locale-change', { detail: { locale } }));
    if (global.AidcLangSwitch?.mount) {
      const root = document.getElementById('lang-switch-root');
      if (root) global.AidcLangSwitch.mount(root);
    }
    return locale;
  }

  function getLookupText(zh) {
    if (locale === 'zh' || !messages.lookup) return zh;
    const v = messages.lookup[zh];
    return v != null ? v : zh;
  }

  global.AidcI18n = {
    init,
    setLocale,
    t,
    applyDom,
    applyMeta,
    getLocale: () => locale,
    getLookupText,
    isActive: () => active,
    localeTag: () => (locale === 'en' ? 'en-US' : 'zh-CN'),
  };
})(typeof window !== 'undefined' ? window : globalThis);
