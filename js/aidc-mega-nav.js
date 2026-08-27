(function (global) {
  'use strict';

  const MENUS = {
    'ai-dc-design.html': {
      id: 'ai-dc',
      columns: [
        {
          titleKey: 'nav.menu.design',
          title: '规划与架构',
          links: [
            ['nav.menu.roomLayout', '机房布局', 'ai-dc-design.html?tab=roomLayout'],
            ['nav.menu.rackAir', '机柜（风冷）', 'ai-dc-design.html?tab=plan'],
            ['nav.menu.tokenCentric', 'Token Centric', 'ai-dc-design.html?tab=synergy'],
          ],
        },
        {
          titleKey: 'nav.menu.cases',
          title: '风冷案例',
          links: [
            ['nav.menu.caseA', '案例A（风冷）', 'ai-dc-design.html?tab=a'],
            ['nav.menu.caseB', '案例B（风冷）', 'ai-dc-design.html?tab=b'],
          ],
        },
        {
          titleKey: 'nav.menu.value',
          title: '效益评估',
          links: [['nav.menu.roi', 'Investment ROI', 'ai-dc-design.html?tab=roi']],
        },
      ],
    },
    'index.html': {
      id: 'inference',
      columns: [
        {
          titleKey: 'nav.menu.inferenceMechanism',
          title: '推理机制',
          links: [
            ['nav.menu.principles', '推理原理', 'index.html?tab=principles#inference'],
            ['nav.menu.dataflow', '推理服务数据流', 'index.html?tab=dataflow#inference'],
          ],
        },
        {
          titleKey: 'nav.menu.deploymentCapacity',
          title: '部署与容量',
          links: [
            ['nav.menu.mixed', 'PD混部', 'index.html?tab=mixed#inference'],
            ['nav.menu.separated', 'PD分离', 'index.html?tab=separated#inference'],
            ['nav.menu.kvCache', 'KV Cache计算', 'index.html?tab=kvcache#inference'],
          ],
        },
      ],
    },
  };

  function translatedSpan(key, fallback, className) {
    const span = document.createElement('span');
    span.dataset.i18n = key;
    span.textContent = fallback;
    if (className) span.className = className;
    return span;
  }

  function translatedText(key, fallback) {
    const value = global.AidcI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  }

  function buildPanel(menu) {
    const panel = document.createElement('div');
    panel.id = `aidc-mega-${menu.id}`;
    panel.className = `aidc-mega-panel aidc-mega-panel--${menu.id}`;
    panel.setAttribute('role', 'region');
    panel.hidden = true;

    const inner = document.createElement('div');
    inner.className = 'aidc-mega-panel__inner';
    inner.style.setProperty('--aidc-mega-columns', String(menu.columns.length));

    menu.columns.forEach((column) => {
      const group = document.createElement('section');
      group.className = 'aidc-mega-column';
      group.appendChild(translatedSpan(column.titleKey, column.title, 'aidc-mega-column__title'));

      const list = document.createElement('div');
      list.className = 'aidc-mega-links';
      column.links.forEach(([key, fallback, href]) => {
        const link = document.createElement('a');
        link.href = href;
        link.className = 'aidc-mega-link';
        link.appendChild(translatedSpan(key, fallback));
        list.appendChild(link);
      });
      group.appendChild(list);
      inner.appendChild(group);
    });

    panel.appendChild(inner);
    return panel;
  }

  function init() {
    if (document.documentElement.classList.contains('aidc-embed')) return;
    const header = document.querySelector('body > header');
    const nav = header?.querySelector('nav');
    const navGroup = nav?.querySelector('#lang-switch-root')?.parentElement;
    const primary = navGroup?.querySelector('ul');
    const language = navGroup?.querySelector('#lang-switch-root');
    global.AidcThemeSwitch?.autoMount?.();
    const theme = document.getElementById('theme-switch-root');
    if (!header || !nav || !navGroup || !primary || !language || header.dataset.megaNavReady) return;

    header.dataset.megaNavReady = 'true';
    header.classList.add('aidc-site-header');
    nav.classList.add('aidc-site-nav');
    navGroup.classList.add('aidc-site-nav__group');
    primary.classList.add('aidc-site-nav__primary');
    language.classList.add('aidc-site-nav__language');

    const utility = document.createElement('div');
    utility.className = 'aidc-site-nav__utility';
    language.insertAdjacentElement('beforebegin', utility);
    utility.appendChild(language);
    if (theme) utility.appendChild(theme);
    nav.appendChild(utility);

    const mobileToggle = document.createElement('button');
    mobileToggle.type = 'button';
    mobileToggle.className = 'aidc-site-nav__mobile-toggle';
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.setAttribute('aria-controls', 'aidc-primary-navigation');
    mobileToggle.dataset.i18nAriaLabel = 'nav.menu.open';
    mobileToggle.setAttribute('aria-label', '打开导航菜单');
    mobileToggle.innerHTML = '<span></span><span></span><span></span>';
    nav.insertBefore(mobileToggle, utility);
    primary.id = 'aidc-primary-navigation';

    let activeItem = null;
    let closeTimer = 0;

    function updateMobileToggleLabel(open) {
      const key = open ? 'nav.menu.close' : 'nav.menu.open';
      const fallback = open ? '关闭导航菜单' : '打开导航菜单';
      mobileToggle.dataset.i18nAriaLabel = key;
      mobileToggle.setAttribute('aria-label', translatedText(key, fallback));
    }

    function placeLanguageControl() {
      if (global.innerWidth < 900) {
        navGroup.appendChild(language);
      } else {
        utility.insertBefore(language, theme || null);
      }
    }

    function closeMenu() {
      global.clearTimeout(closeTimer);
      activeItem = null;
      header.classList.remove('aidc-mega-open');
      primary.querySelectorAll('.aidc-mega-item').forEach((item) => {
        item.classList.remove('is-open');
        item.querySelector(':scope > a')?.setAttribute('aria-expanded', 'false');
        const panel = item.querySelector(':scope > .aidc-mega-panel');
        if (panel) panel.hidden = true;
      });
    }

    function openMenu(item) {
      if (!item) return;
      global.clearTimeout(closeTimer);
      if (activeItem && activeItem !== item) closeMenu();
      activeItem = item;
      item.classList.add('is-open');
      item.querySelector(':scope > a')?.setAttribute('aria-expanded', 'true');
      const panel = item.querySelector(':scope > .aidc-mega-panel');
      if (panel) panel.hidden = false;
      header.classList.add('aidc-mega-open');
    }

    Object.entries(MENUS).forEach(([href, menu]) => {
      const trigger = Array.from(primary.querySelectorAll(':scope > li > a')).find((link) => {
        const url = new URL(link.href, global.location.href);
        return url.pathname.endsWith(`/${href}`);
      });
      const item = trigger?.closest('li');
      if (!trigger || !item) return;

      item.classList.add('aidc-mega-item');
      trigger.classList.add('aidc-mega-trigger');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', `aidc-mega-${menu.id}`);
      const triggerLabel = document.createElement('span');
      triggerLabel.textContent = trigger.textContent.trim();
      if (trigger.dataset.i18n) {
        triggerLabel.dataset.i18n = trigger.dataset.i18n;
        trigger.removeAttribute('data-i18n');
      }
      const chevron = document.createElement('span');
      chevron.className = 'aidc-mega-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      trigger.replaceChildren(triggerLabel, chevron);

      const panel = buildPanel(menu);
      item.appendChild(panel);

      item.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'touch' && global.matchMedia('(min-width: 900px)').matches) openMenu(item);
      });
      item.addEventListener('pointerleave', () => {
        if (global.matchMedia('(min-width: 900px)').matches) {
          closeTimer = global.setTimeout(closeMenu, 120);
        }
      });
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        item.classList.contains('is-open') ? closeMenu() : openMenu(item);
      });
    });

    mobileToggle.addEventListener('click', () => {
      const open = navGroup.classList.toggle('is-open');
      mobileToggle.classList.toggle('is-open', open);
      mobileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      updateMobileToggleLabel(open);
      if (!open) closeMenu();
    });

    document.addEventListener('click', (event) => {
      if (!header.contains(event.target)) {
        closeMenu();
        navGroup.classList.remove('is-open');
        mobileToggle.classList.remove('is-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        navGroup.classList.remove('is-open');
        mobileToggle.classList.remove('is-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.focus();
      }
    });
    global.addEventListener('resize', () => {
      placeLanguageControl();
      if (global.innerWidth >= 900) {
        navGroup.classList.remove('is-open');
        mobileToggle.classList.remove('is-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      } else {
        closeMenu();
      }
    });
    global.addEventListener('aidc-locale-change', () => {
      updateMobileToggleLabel(mobileToggle.getAttribute('aria-expanded') === 'true');
    });
    placeLanguageControl();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
