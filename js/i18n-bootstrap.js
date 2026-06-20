/**
 * 单页 i18n 通用启动：读取 ?lang=、init、applyDom、挂载语言切换。
 */
(function (global) {
  async function bootstrap(pageId, options) {
    const opts = options || {};
    const params = new URLSearchParams(global.location.search);
    const lang = params.get('lang');
    if (lang === 'zh' || lang === 'en') {
      try {
        global.localStorage.setItem('aidc-locale', lang);
      } catch (_) {
        /* ignore */
      }
    }
    await global.AidcI18n.init({
      page: pageId,
      common: true,
      basePath: opts.basePath || 'i18n/',
    });
    global.AidcI18n.applyDom();
    global.__aidcI18nAfterLocaleChange = function () {
      if (typeof opts.onLocaleChange === 'function') opts.onLocaleChange();
      else if (typeof global.__aidcPageRefreshI18n === 'function') global.__aidcPageRefreshI18n();
    };
    const langRoot = document.getElementById('lang-switch-root');
    if (global.AidcLangSwitch?.mount && langRoot) {
      global.AidcLangSwitch.mount(langRoot);
    } else if (langRoot) {
      console.warn('[AidcI18n] lang-switch.js 未加载，语言切换不可用');
    }
    if (typeof opts.onReady === 'function') opts.onReady();
  }

  global.AidcI18nBootstrap = { bootstrap };
})(typeof window !== 'undefined' ? window : globalThis);
