/**
 * Topic 目录页：读取 data/topics.json，渲染白皮书与观点卡片。
 */
(function (global) {
  'use strict';

  const TOPICS_PATH = 'data/topics.json';
  let cachedTopics = null;
  let cachedError = false;

  function t(key, params) {
    return global.AidcI18n?.t?.(key, params) || key;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function currentLocale() {
    const loc = global.AidcI18n?.getLocale?.() || 'zh';
    return loc === 'en' ? 'en' : 'zh';
  }

  function isPublished(topic) {
    return Boolean(topic && topic.status === 'published' && typeof topic.href === 'string' && topic.href.trim());
  }

  function isVisibleForLocale(topic, locale) {
    const locales = topic && topic.locales;
    if (!Array.isArray(locales) || locales.length === 0) return true;
    return locales.indexOf(locale) !== -1;
  }

  function applyI18n(root) {
    if (global.AidcI18n?.applyDom) global.AidcI18n.applyDom(root);
  }

  function renderTopicCard(topic) {
    const id = String(topic.id || '').trim();
    const kind = topic.kind === 'html' ? 'html' : 'pdf';
    const year = topic.year == null || topic.year === '' ? '' : String(topic.year);
    const published = isPublished(topic);
    const href = published ? topic.href.trim() : '';
    const kindKey = kind === 'html' ? 'page.kindHtml' : 'page.kindPdf';
    const ctaKey = published ? 'page.readCta' : 'page.comingCta';

    const card = document.createElement(published ? 'a' : 'article');
    card.className = published
      ? 'relative flex min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 transition hover:border-slate-300 hover:shadow-slate-300/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:p-8'
      : 'relative flex min-w-0 flex-col rounded-3xl border border-dashed border-slate-300 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8';
    if (published) card.setAttribute('href', href);
    card.setAttribute('data-topic-id', id);
    card.setAttribute('data-topic-kind', kind);

    const yearHtml = year
      ? `<span class="pointer-events-none absolute right-5 top-3 select-none text-5xl font-bold tabular-nums text-slate-200/50 sm:text-6xl" aria-hidden="true">${escapeHtml(year)}</span>`
      : '';
    const ctaHtml = published
      ? `<span class="relative mt-6 inline-flex w-fit items-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25" data-i18n="${ctaKey}">${escapeHtml(t(ctaKey))}</span>`
      : `<p class="relative mt-6 inline-flex w-fit items-center rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500" data-i18n="${ctaKey}">${escapeHtml(t(ctaKey))}</p>`;

    card.innerHTML = `
      ${yearHtml}
      <p class="relative text-xs font-semibold uppercase tracking-[0.14em] text-blue-600" data-i18n="${kindKey}">${escapeHtml(t(kindKey))}</p>
      <h2 class="relative mt-2 text-xl font-bold text-slate-950 sm:text-2xl" data-i18n="topics.${id}.title">${escapeHtml(t(`topics.${id}.title`))}</h2>
      <p class="relative mt-3 flex-1 text-sm leading-6 text-slate-600 sm:text-base" data-i18n="topics.${id}.summary">${escapeHtml(t(`topics.${id}.summary`))}</p>
      ${ctaHtml}
    `;
    applyI18n(card);
    return card;
  }

  function setStatus(messageKey, visible) {
    const status = document.getElementById('topic-status');
    if (!status) return;
    status.hidden = !visible;
    if (visible && messageKey) {
      status.setAttribute('data-i18n', messageKey);
      status.textContent = t(messageKey);
      applyI18n(status);
    }
  }

  function renderTopics(topics) {
    const grid = document.getElementById('topic-grid');
    if (!grid) return;

    grid.replaceChildren();
    const locale = currentLocale();
    (topics || []).forEach((topic) => {
      if (!topic || !topic.id) return;
      if (!isVisibleForLocale(topic, locale)) return;
      grid.appendChild(renderTopicCard(topic));
    });

    const hasCards = grid.childElementCount > 0;
    grid.hidden = !hasCards;
    if (!hasCards) {
      setStatus('page.empty', true);
      return;
    }
    setStatus('', false);
  }

  async function loadTopics() {
    try {
      const res = await fetch(TOPICS_PATH, { cache: 'no-store' });
      if (!res.ok) throw new Error(`topics ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.topics) ? data.topics : [];
      cachedTopics = list;
      cachedError = false;
      return list;
    } catch {
      cachedTopics = [];
      cachedError = true;
      return null;
    }
  }

  async function initTopicPage() {
    const grid = document.getElementById('topic-grid');
    if (!grid) return;

    if (cachedError) {
      grid.hidden = true;
      grid.replaceChildren();
      setStatus('page.loadError', true);
      return;
    }

    if (!cachedTopics) {
      setStatus('page.loading', true);
      const loaded = await loadTopics();
      if (loaded == null) {
        grid.hidden = true;
        grid.replaceChildren();
        setStatus('page.loadError', true);
        return;
      }
      renderTopics(loaded);
      return;
    }

    renderTopics(cachedTopics);
  }

  global.initTopicPage = initTopicPage;
})(typeof window !== 'undefined' ? window : globalThis);
