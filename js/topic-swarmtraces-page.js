/**
 * SwarmTraces 专题页：按语言嵌入 HTML；仅中文提供同目录 PDF 下载。
 */
(function (global) {
  'use strict';

  const HTML_PATHS = {
    zh: 'topic/swarmtraces/swarmtraces技术分析报告.html',
    en: 'topic/swarmtraces/swarmtraces-technical-analysis.html',
  };
  const PDF_PATH = 'topic/swarmtraces/swarmtraces技术分析报告.pdf';

  function t(key) {
    return global.AidcI18n?.t?.(key) || key;
  }

  function currentLocale() {
    return global.AidcI18n?.getLocale?.() === 'en' ? 'en' : 'zh';
  }

  async function probe(path) {
    try {
      const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    }
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

  async function initTopicSwarmtracesPage() {
    const locale = currentLocale();
    const htmlPath = HTML_PATHS[locale];
    const viewer = document.getElementById('swarmtraces-viewer');
    const openLink = document.querySelector('[data-swarmtraces-action="open"]');
    const downloadLink = document.querySelector('[data-swarmtraces-action="download"]');
    const htmlOk = await probe(htmlPath);

    if (viewer) {
      viewer.setAttribute('title', t('edition.iframeTitle'));
      if (htmlOk && viewer.getAttribute('src') !== htmlPath) {
        viewer.setAttribute('src', htmlPath);
      }
    }

    setLinkEnabled(openLink, htmlOk, htmlPath);

    if (downloadLink) {
      const showPdf = locale === 'zh';
      downloadLink.hidden = !showPdf;
      downloadLink.classList.toggle('hidden', !showPdf);
      downloadLink.classList.toggle('inline-flex', showPdf);
      downloadLink.setAttribute('download', t('edition.downloadName'));
      if (showPdf) {
        const pdfOk = await probe(PDF_PATH);
        setLinkEnabled(downloadLink, pdfOk, PDF_PATH);
      } else {
        setLinkEnabled(downloadLink, false);
      }
    }
  }

  global.initTopicSwarmtracesPage = initTopicSwarmtracesPage;
})(typeof window !== 'undefined' ? window : globalThis);
