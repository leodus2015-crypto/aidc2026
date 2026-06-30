function refreshInferenceBasicPage() {
  if (!window.AidcI18n) return;
  const t = (k, p) => AidcI18n.t(k, p);
  document.querySelectorAll('[data-diagram-iter]').forEach((el) => {
    const n = el.getAttribute('data-diagram-iter');
    if (n === '1') {
      el.textContent = t('diagram.iter1');
    } else if (n) {
      el.textContent = t('diagram.iterN', { n });
    }
  });
}

window.__aidcPageRefreshI18n = refreshInferenceBasicPage;

function initInferenceBasicPage() {
  refreshInferenceBasicPage();
}

window.initInferenceBasicPage = initInferenceBasicPage;
