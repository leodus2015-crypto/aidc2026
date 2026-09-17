/**
 * 白皮书 2026 预览页：按站点语言切换中英 PDF，两份均可下载。
 */
(function (global) {
  'use strict';

  const PDFS = {
    zh: { path: 'topic/ai-dc-white-paper-2026-cn.pdf' },
    en: { path: 'topic/ai-dc-white-paper-2026-en.pdf' },
  };

  const availability = { zh: null, en: null };

  function t(key, params) {
    return global.AidcI18n?.t?.(key, params) || key;
  }

  function currentLocale() {
    const loc = global.AidcI18n?.getLocale?.() || 'zh';
    return loc === 'en' ? 'en' : 'zh';
  }

  async function probePdf(path) {
    try {
      const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function pdfAvailable(locale) {
    if (availability[locale] == null) {
      availability[locale] = await probePdf(PDFS[locale].path);
    }
    return availability[locale];
  }

  function setLinkEnabled(link, enabled, href) {
    if (!link) return;
    if (enabled && href) {
      link.removeAttribute('aria-disabled');
      link.classList.remove('pointer-events-none', 'opacity-50');
      link.setAttribute('href', href);
    } else {
      link.setAttribute('aria-disabled', 'true');
      link.classList.add('pointer-events-none', 'opacity-50');
      link.removeAttribute('href');
    }
  }

  async function initWhitePaper2026Page() {
    const locale = currentLocale();
    const current = PDFS[locale];
    const viewer = document.getElementById('whitepaper-2026-viewer');
    const missing = document.getElementById('whitepaper-missing');
    const hint = document.getElementById('whitepaper-fallback-hint');
    const openLink = document.querySelector('[data-whitepaper-action="open"]');
    const zhLink = document.querySelector('[data-whitepaper-edition="zh"]');
    const enLink = document.querySelector('[data-whitepaper-edition="en"]');

    const [zhOk, enOk] = await Promise.all([pdfAvailable('zh'), pdfAvailable('en')]);
    const currentOk = locale === 'en' ? enOk : zhOk;

    if (zhLink) {
      zhLink.setAttribute('download', t('edition.downloadNameZh'));
      setLinkEnabled(zhLink, zhOk, PDFS.zh.path);
    }
    if (enLink) {
      enLink.setAttribute('download', t('edition.downloadNameEn'));
      setLinkEnabled(enLink, enOk, PDFS.en.path);
    }

    if (currentOk) {
      if (viewer) {
        viewer.hidden = false;
        if (viewer.getAttribute('src') !== current.path) {
          viewer.setAttribute('src', current.path);
        }
        viewer.setAttribute('title', t('edition.iframeTitle'));
      }
      if (missing) missing.hidden = true;
      if (hint) hint.hidden = false;
      setLinkEnabled(openLink, true, current.path);
      return;
    }

    if (viewer) {
      viewer.hidden = true;
      viewer.removeAttribute('src');
    }
    if (missing) missing.hidden = false;
    if (hint) hint.hidden = true;
    setLinkEnabled(openLink, false);

    const title = document.getElementById('whitepaper-missing-title');
    const desc = document.getElementById('whitepaper-missing-desc');
    const deploy = document.getElementById('whitepaper-missing-deploy');
    if (title) title.textContent = t('edition.missingTitle');
    if (desc) desc.textContent = t('edition.missingDesc');
    if (deploy) deploy.textContent = t('edition.missingDeployHint');
  }

  global.initWhitePaper2026Page = initWhitePaper2026Page;
})(typeof window !== 'undefined' ? window : globalThis);
