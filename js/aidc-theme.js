/**
 * 全站 Light / Dark 主题：持久化、URL 参数、跨 iframe 同步与浏览器主题色。
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'aidc-theme';
  const MSG_TYPE = 'aidc-theme-change';
  const THEMES = ['light', 'dark'];

  function normalizeTheme(value) {
    return THEMES.includes(value) ? value : null;
  }

  function readFromUrl() {
    try {
      return normalizeTheme(new URLSearchParams(global.location.search || '').get('theme'));
    } catch (_) {
      return null;
    }
  }

  function readStored() {
    try {
      return normalizeTheme(global.localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return null;
    }
  }

  function getTheme() {
    const applied = global.document && normalizeTheme(global.document.documentElement.dataset.theme);
    return applied || readFromUrl() || readStored() || 'light';
  }

  function updateThemeColor(theme) {
    if (!global.document) return;
    const meta = global.document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07111f' : '#f8fafc');
  }

  function applyTheme(theme) {
    const next = normalizeTheme(theme) || 'light';
    const root = global.document && global.document.documentElement;
    if (root) {
      root.dataset.theme = next;
      root.classList.toggle('dark', next === 'dark');
      root.style.colorScheme = next;
    }
    updateThemeColor(next);
    return next;
  }

  function persistTheme(theme) {
    try {
      global.localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {
      /* ignore */
    }
  }

  function broadcastToIframes(theme, source) {
    if (!global.document) return;
    global.document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        iframe.contentWindow.postMessage(
          { type: MSG_TYPE, theme, source: source || 'parent' },
          '*'
        );
      } catch (_) {
        /* ignore */
      }
    });
  }

  function emit(theme, source) {
    global.dispatchEvent(
      new CustomEvent('aidc-theme-change', {
        detail: { theme, source: source || 'theme' },
      })
    );
  }

  function setTheme(theme, options) {
    const next = normalizeTheme(theme);
    if (!next) return getTheme();
    const opts = options || {};
    applyTheme(next);
    if (opts.persist !== false) persistTheme(next);
    emit(next, opts.source);

    if (opts.notifyParent !== false && global.parent && global.parent !== global) {
      try {
        global.parent.postMessage(
          { type: MSG_TYPE, theme: next, source: opts.source || 'iframe' },
          '*'
        );
      } catch (_) {
        /* ignore */
      }
    }
    if (opts.broadcast !== false) broadcastToIframes(next, opts.source);
    return next;
  }

  function handleExternalTheme(theme, source) {
    const next = normalizeTheme(theme);
    if (!next) return;
    applyTheme(next);
    persistTheme(next);
    emit(next, source);
    broadcastToIframes(next, source);
  }

  global.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    handleExternalTheme(event.newValue, 'storage');
  });

  global.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== MSG_TYPE) return;
    handleExternalTheme(data.theme, data.source || 'postMessage');
  });

  const initialTheme = applyTheme(getTheme());
  if (readFromUrl()) persistTheme(initialTheme);

  global.AidcTheme = {
    STORAGE_KEY,
    MSG_TYPE,
    THEMES,
    getTheme,
    setTheme,
    applyTheme,
    broadcastToIframes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
