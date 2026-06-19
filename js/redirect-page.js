/**
 * 重定向页：按 locale 生成 index.html 链接（含 ?lang=en）。
 */
(function (global) {
  function resolveLocale() {
    const params = new URLSearchParams(global.location.search);
    let lang = params.get('lang');
    if (lang === 'zh' || lang === 'en') {
      try {
        global.localStorage.setItem('aidc-locale', lang);
      } catch (_) {
        /* ignore */
      }
      return lang;
    }
    try {
      lang = global.localStorage.getItem('aidc-locale');
    } catch (_) {
      /* ignore */
    }
    return lang === 'en' ? 'en' : 'zh';
  }

  function indexUrl(hash) {
    const locale = resolveLocale();
    const q = locale === 'en' ? '?lang=en' : '';
    return `index.html${q}${hash || ''}`;
  }

  global.AidcRedirectPage = { indexUrl, resolveLocale };
})(typeof window !== 'undefined' ? window : globalThis);
