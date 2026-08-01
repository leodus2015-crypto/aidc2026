/**
 * 白皮书页：检测 PDF 是否可用，缺失时展示友好 fallback。
 */
(function (global) {
  'use strict';

  const PDF_PATH = 'assets/aidc-whitepaper-2024-zh.pdf';

  function t(key, params) {
    return global.AidcI18n?.t?.(key, params) || key;
  }

  async function pdfAvailable() {
    try {
      const res = await fetch(PDF_PATH, { method: 'HEAD', cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    }
  }

  function setActionsEnabled(enabled) {
    document.querySelectorAll('[data-whitepaper-action]').forEach((link) => {
      if (enabled) {
        link.removeAttribute('aria-disabled');
        link.classList.remove('pointer-events-none', 'opacity-50');
        if (link.dataset.href) link.setAttribute('href', link.dataset.href);
      } else {
        link.dataset.href = link.getAttribute('href') || PDF_PATH;
        link.setAttribute('aria-disabled', 'true');
        link.classList.add('pointer-events-none', 'opacity-50');
        link.removeAttribute('href');
      }
    });
  }

  async function initWhitePaperPage() {
    const viewer = document.getElementById('whitepaper-2024-viewer');
    const missing = document.getElementById('whitepaper-missing');
    const hint = document.getElementById('whitepaper-fallback-hint');
    const ok = await pdfAvailable();

    if (ok) {
      if (viewer) viewer.hidden = false;
      if (missing) missing.hidden = true;
      if (hint) hint.hidden = false;
      setActionsEnabled(true);
      return;
    }

    if (viewer) viewer.hidden = true;
    if (missing) missing.hidden = false;
    if (hint) hint.hidden = true;
    setActionsEnabled(false);

    const title = document.getElementById('whitepaper-missing-title');
    const desc = document.getElementById('whitepaper-missing-desc');
    const deploy = document.getElementById('whitepaper-missing-deploy');
    if (title) title.textContent = t('edition.missingTitle');
    if (desc) desc.textContent = t('edition.missingDesc');
    if (deploy) deploy.textContent = t('edition.missingDeployHint');
  }

  global.initWhitePaperPage = initWhitePaperPage;
})(typeof window !== 'undefined' ? window : globalThis);
