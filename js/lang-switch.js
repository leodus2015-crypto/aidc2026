/**
 * 全站语言切换：i18n 单页（data-i18n-page）或 legacy 页（?lang= 查询参数）。
 */
(function (global) {
  function currentFile() {
    const parts = global.location.pathname.split('/');
    const last = parts[parts.length - 1] || 'index.html';
    return decodeURIComponent(last);
  }

  function isEnglishPage() {
    const params = new URLSearchParams(global.location.search || '');
    if (params.get('lang') === 'en') return true;
    return /\/en\/[^/]*$/.test(global.location.pathname) || /\/en\/$/.test(global.location.pathname);
  }

  function usesI18nPage() {
    return Boolean(document.body && document.body.dataset && document.body.dataset.i18nPage);
  }

  function localeHref(locale) {
    const url = new URL(global.location.href);
    url.searchParams.set('lang', locale);
    return url.pathname + url.search + url.hash;
  }

  function chineseHref() {
    if (/\/en\/[^/]*$/.test(global.location.pathname)) {
      return '../' + currentFile() + '?lang=zh' + (global.location.hash || '');
    }
    return localeHref('zh');
  }

  function englishHref() {
    if (/\/en\/[^/]*$/.test(global.location.pathname)) {
      return '../' + currentFile() + '?lang=en' + (global.location.hash || '');
    }
    return localeHref('en');
  }

  function i18nPageId() {
    return document.body.dataset.i18nPage;
  }

  function switchLocale(nextLocale, event) {
    if (event) event.preventDefault();
    if (!global.AidcI18n || !global.AidcI18n.setLocale) return;
    global.AidcI18n.setLocale(nextLocale, {
      page: i18nPageId(),
      common: true,
      basePath: 'i18n/',
    });
  }

  function mountI18nSwitch(root) {
    if (!root || !global.AidcI18n) return;
    const locale = global.AidcI18n.getLocale();
    const zhActive = locale === 'zh';
    const enActive = locale === 'en';
    const aria = global.AidcI18n.t('lang.switchAria') || 'Language';

    root.innerHTML =
      '<div class="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold shadow-sm" role="group" aria-label="' +
      aria +
      '">' +
      '<button type="button" data-locale="zh" class="rounded-md px-2.5 py-1 transition ' +
      (zhActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800') +
      '"' +
      (zhActive ? ' aria-current="true"' : '') +
      '>' +
      (global.AidcI18n.t('lang.zh') || '中文') +
      '</button>' +
      '<button type="button" data-locale="en" class="rounded-md px-2.5 py-1 transition ' +
      (enActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800') +
      '"' +
      (enActive ? ' aria-current="true"' : '') +
      '>' +
      (global.AidcI18n.t('lang.en') || 'EN') +
      '</button>' +
      '</div>';

    root.querySelectorAll('[data-locale]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        const next = btn.getAttribute('data-locale');
        if (next && next !== global.AidcI18n.getLocale()) {
          switchLocale(next, event);
        }
      });
    });
  }

  function mountLegacySwitch(root) {
    if (!root) return;
    const en = isEnglishPage();
    const zhActive = !en;
    const enActive = en;
    root.innerHTML =
      '<div class="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold shadow-sm" role="group" aria-label="Language">' +
      '<a href="' +
      (zhActive ? '#' : chineseHref()) +
      '" class="rounded-md px-2.5 py-1 transition ' +
      (zhActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800') +
      '"' +
      (zhActive ? ' aria-current="true"' : '') +
      '>中文</a>' +
      '<a href="' +
      (enActive ? '#' : englishHref()) +
      '" class="rounded-md px-2.5 py-1 transition ' +
      (enActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800') +
      '"' +
      (enActive ? ' aria-current="true"' : '') +
      '>EN</a>' +
      '</div>';
  }

  function mount(root) {
    if (usesI18nPage()) {
      mountI18nSwitch(root);
      return;
    }
    mountLegacySwitch(root);
  }

  global.AidcLangSwitch = {
    mount,
    isEnglishPage,
    usesI18nPage,
    chineseHref,
    englishHref,
    switchLocale,
  };
})(typeof window !== 'undefined' ? window : globalThis);
