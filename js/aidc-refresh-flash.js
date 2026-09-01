/**
 * 全站公共：内容区刷新脉冲（大导航同 Tab 再点等场景）。
 */
(function (global) {
  'use strict';

  const DEFAULT_CARD_SELECTOR = ':scope > .rounded-3xl';
  const CLASS_NAME = 'aidc-refresh-flash';
  const CLEANUP_MS = 700;

  function resolveElement(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    if (target instanceof Element) return target;
    return null;
  }

  function pulse(target, options) {
    const el = resolveElement(target);
    if (!el) return false;

    const opts = options || {};
    el.classList.remove(CLASS_NAME);
    void el.offsetWidth;
    el.classList.add(CLASS_NAME);

    const cleanup = () => el.classList.remove(CLASS_NAME);
    el.addEventListener('animationend', cleanup, { once: true });
    global.setTimeout(cleanup, opts.cleanupMs || CLEANUP_MS);
    return true;
  }

  function pulsePanel(panel, options) {
    if (!panel) return false;
    const opts = options || {};
    const cardSelector = opts.cardSelector || DEFAULT_CARD_SELECTOR;
    const card = panel.querySelector(cardSelector);
    return pulse(card || panel, opts);
  }

  global.AidcRefreshFlash = {
    pulse,
    pulsePanel,
    className: CLASS_NAME,
  };
})(typeof window !== 'undefined' ? window : globalThis);
