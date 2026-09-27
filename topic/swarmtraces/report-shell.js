/**
 * 独立打开报告时：顶栏回站、桌面左侧目录。iframe / 窄屏保持原文阅读版式。
 */
(function () {
  'use strict';

  function isEmbed() {
    if (new URLSearchParams(window.location.search || '').get('embed') === '1') {
      return true;
    }
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  function locale() {
    return (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
  }

  const COPY = {
    zh: {
      homeAria: 'AIDC 2026 · 首页',
      design: 'AI DC规划',
      topic: 'Topic',
      about: 'About US',
      back: '返回网站',
      contents: '目录',
    },
    en: {
      homeAria: 'AIDC 2026 · Home',
      design: 'AI DC Design',
      topic: 'Topic',
      about: 'About US',
      back: 'Back to site',
      contents: 'Contents',
    },
  };

  function buildBar(t) {
    const bar = document.createElement('header');
    bar.className = 'site-bar';
    bar.innerHTML =
      '<a class="site-bar-brand" href="../../ai-dc-design.html">' +
      '<img src="../../aidc2026-logo.svg" alt="" width="593" height="118"/>' +
      '</a>' +
      '<nav class="site-bar-links" aria-label="' + t.homeAria + '">' +
      '<a href="../../ai-dc-design.html">' + t.design + '</a>' +
      '<a href="../../topic.html">' + t.topic + '</a>' +
      '<a href="../../about-us.html">' + t.about + '</a>' +
      '<a class="site-bar-back" href="../../topic-swarmtraces.html">' + t.back + '</a>' +
      '</nav>';
    const brand = bar.querySelector('.site-bar-brand');
    if (brand) brand.setAttribute('aria-label', t.homeAria);
    return bar;
  }

  function fillToc(toc, main, t) {
    toc.setAttribute('aria-label', t.contents);
    const title = document.createElement('p');
    title.className = 'toc-title';
    title.textContent = t.contents;
    const list = document.createElement('ol');
    const headings = main.querySelectorAll('article h2, article h3');
    const links = [];
    headings.forEach(function (el, index) {
      if (!el.id) el.id = 'sec-' + (index + 1);
      const li = document.createElement('li');
      li.className = el.tagName === 'H3' ? 'toc-h3' : 'toc-h2';
      const a = document.createElement('a');
      a.href = '#' + el.id;
      a.textContent = (el.textContent || '').replace(/\s+/g, ' ').trim();
      li.appendChild(a);
      list.appendChild(li);
      links.push({ heading: el, link: a });
    });
    toc.append(title, list);
    if (!links.length || !window.IntersectionObserver) return;
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (item) {
            item.link.classList.toggle('is-active', item.heading === entry.target);
          });
        });
      },
      { rootMargin: '-18% 0px -72% 0px', threshold: 0 }
    );
    links.forEach(function (item) {
      io.observe(item.heading);
    });
  }

  function init() {
    const html = document.documentElement;
    if (isEmbed()) {
      html.classList.add('is-embed');
      return;
    }
    html.classList.add('is-standalone');
    const t = COPY[locale()];
    const main = document.createElement('div');
    main.className = 'report-main';
    Array.from(document.body.childNodes).forEach(function (node) {
      main.appendChild(node);
    });
    const toc = document.createElement('nav');
    toc.className = 'toc';
    const shell = document.createElement('div');
    shell.className = 'report-shell';
    shell.append(toc, main);
    document.body.append(buildBar(t), shell);
    fillToc(toc, main, t);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
