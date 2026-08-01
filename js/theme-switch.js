/**
 * Light / Dark 切换控件。默认自动插入页面左侧 Logo 右边。
 */
(function (global) {
  'use strict';

  function label(key, fallback) {
    const translated = global.AidcI18n?.t?.(key);
    return translated && translated !== key ? translated : fallback;
  }

  function mount(root) {
    if (!root || !global.AidcTheme) return;
    const current = global.AidcTheme.getTheme();
    const light = label('theme.light', 'Light');
    const dark = label('theme.dark', 'Dark');
    const aria = label('theme.switchAria', 'Display theme');

    root.innerHTML = `
      <div class="aidc-theme-switch" role="group" aria-label="${aria}">
        <button type="button" data-theme-value="light" aria-pressed="${current === 'light'}">
          <span class="aidc-theme-icon" aria-hidden="true">☀</span>
          <span class="aidc-theme-label">${light}</span>
        </button>
        <button type="button" data-theme-value="dark" aria-pressed="${current === 'dark'}">
          <span class="aidc-theme-icon" aria-hidden="true">◐</span>
          <span class="aidc-theme-label">${dark}</span>
        </button>
      </div>`;

    root.querySelectorAll('[data-theme-value]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.getAttribute('data-theme-value');
        if (next && next !== global.AidcTheme.getTheme()) {
          global.AidcTheme.setTheme(next, { source: 'theme-switch' });
        }
      });
    });
  }

  function findOrCreateRoot() {
    let root = global.document.getElementById('theme-switch-root');
    if (root) return root;
    const logo = global.document.querySelector('header nav a img');
    const logoLink = logo && logo.closest('a');
    if (!logoLink) return null;
    root = global.document.createElement('div');
    root.id = 'theme-switch-root';
    root.className = 'aidc-theme-switch-root shrink-0';
    logoLink.insertAdjacentElement('afterend', root);
    return root;
  }

  function autoMount() {
    if (global.document.documentElement.classList.contains('aidc-embed')) return;
    const root = findOrCreateRoot();
    if (root) mount(root);
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  } else {
    autoMount();
  }

  global.addEventListener('aidc-theme-change', () => {
    const root = global.document.getElementById('theme-switch-root');
    if (root) mount(root);
  });
  global.addEventListener('aidc-locale-change', () => {
    const root = global.document.getElementById('theme-switch-root');
    if (root) mount(root);
  });

  global.AidcThemeSwitch = { mount, autoMount };
})(typeof window !== 'undefined' ? window : globalThis);
