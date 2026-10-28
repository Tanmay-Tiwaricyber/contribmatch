/**
 * Shared page chrome.
 *
 * A small ES module injects the header and the footer into every page, so the
 * navigation and the footer stay identical across the site. Links are
 * relative, which keeps the site working from a GitHub Pages sub-path.
 */

import { el, qs, qsa } from './dom.js';
import { icon } from './icons.js';
import { createLogoLockup } from './logo.js';
import { t, getLanguage, setLanguage } from './i18n.js';
import { toggleTheme, getThemeMode, setTheme } from './theme.js';

const NAV = [
  { href: 'index.html', key: 'nav.home', id: 'home' },
  { href: 'index.html#how', key: 'nav.how', id: 'how' },
  { href: 'index.html#features', key: 'nav.features', id: 'features' },
  { href: 'packs.html', key: 'nav.packs', id: 'packs' },
  { href: 'docs.html', key: 'nav.docs', id: 'docs' },
  { href: 'contribute.html', key: 'nav.contribute', id: 'contribute' },
];

const FOOTER_COLUMNS = [
  {
    title: 'footer.product',
    links: [
      { href: 'app.html', key: 'nav.openApp' },
      { href: 'shortlist.html', key: 'footer.shortlist' },
      { href: 'packs.html', key: 'nav.packs' },
      { href: 'design-system.html', key: 'nav.design' },
    ],
  },
  {
    title: 'footer.community',
    links: [
      { href: 'contribute.html', key: 'nav.contribute' },
      { href: 'packs.html#add', key: 'packs.add' },
      { href: 'open-innovation.html', key: 'nav.home', label: 'Why open innovation matters' },
      { href: 'https://github.com/Tanmay-Tiwaricyber/contribmatch/issues', key: 'nav.contribute', label: 'Issue tracker' },
    ],
  },
  {
    title: 'footer.resources',
    links: [
      { href: 'docs.html', key: 'nav.docs' },
      { href: 'privacy.html', key: 'nav.privacy' },
      { href: 'https://github.com/Tanmay-Tiwaricyber/contribmatch', key: 'footer.repo' },
      { href: 'https://github.com/Tanmay-Tiwaricyber/contribmatch/blob/main/LICENSE', key: 'footer.license' },
    ],
  },
];

const REPO_URL = 'https://github.com/Tanmay-Tiwaricyber/contribmatch';

/** Build the language switch. */
function createLanguageSwitch() {
  const wrap = el('div', { class: 'lang-switch', role: 'group', 'aria-label': t('lang.label') });
  for (const code of ['en', 'hi', 'hinglish']) {
    const btn = el('button', {
      type: 'button',
      class: 'lang-switch__btn',
      'aria-pressed': String(getLanguage() === code),
      dataset: { lang: code },
      text: t(`lang.${code}`),
    });
    btn.addEventListener('click', () => {
      setLanguage(code);
      qsa('.lang-switch__btn', wrap).forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.lang === code));
      });
      // Re-render the chrome so the labels update too.
      document.dispatchEvent(new CustomEvent('chrome:refresh'));
    });
    wrap.append(btn);
  }
  return wrap;
}

/** Build the theme toggle. */
function createThemeToggle() {
  const btn = el('button', {
    type: 'button',
    class: 'theme-toggle',
    'aria-label': `${t('theme.toggle')} (${t(`theme.${getThemeMode() === 'system' ? 'system' : getThemeMode()}`)})`,
    title: t('theme.toggle'),
  });
  btn.append(icon('sun', { className: 'icon-sun' }), icon('moon', { className: 'icon-moon' }));
  btn.addEventListener('click', () => {
    const next = toggleTheme();
    btn.setAttribute('aria-label', `${t('theme.toggle')} (${t(`theme.${next}`)})`);
  });
  return btn;
}

/** Build the header. */
export function createHeader() {
  const header = el('header', { class: 'site-header' });
  const inner = el('div', { class: 'container site-header__inner' });

  inner.append(createLogoLockup());

  const nav = el('nav', { class: 'site-nav', id: 'site-nav', 'aria-label': 'Main' });
  const current = currentPageId();
  for (const item of NAV) {
    const link = el('a', {
      class: 'site-nav__link',
      href: item.href,
      text: t(item.key),
    });
    if (item.id === current) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  // The language switch lives in the header on wide screens and moves into
  // the menu on narrow ones, where there is no room for it in the bar.
  const navLang = createLanguageSwitch();
  navLang.classList.add('site-nav__lang');
  nav.append(navLang);
  const cta = el('a', {
    class: 'btn btn--primary btn--sm site-nav__cta',
    href: 'app.html',
    text: t('nav.openApp'),
  });
  if (isMatcherPage()) cta.setAttribute('aria-current', 'page');
  nav.append(cta);

  const actions = el('div', { class: 'header-actions' }, [
    createLanguageSwitch(),
    createThemeToggle(),
  ]);

  const toggle = el('button', {
    type: 'button',
    class: 'nav-toggle',
    'aria-label': t('nav.menuOpen'),
    'aria-expanded': 'false',
    'aria-controls': 'site-nav',
  });
  toggle.append(icon('menu', { className: 'icon-menu' }), icon('close', { className: 'icon-close' }));
  actions.append(toggle);

  inner.append(nav, actions);
  header.append(inner);

  // --- Mobile menu behaviour ------------------------------------------------
  function closeMenu() {
    nav.dataset.open = 'false';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', t('nav.menuOpen'));
    document.removeEventListener('keydown', onKeydown);
  }

  function openMenu() {
    nav.dataset.open = 'true';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', t('nav.menuClose'));
    document.addEventListener('keydown', onKeydown);
    const first = nav.querySelector('a, button');
    first?.focus();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      closeMenu();
      toggle.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    // Trap focus inside the open menu.
    const focusables = qsa('a[href], button:not([disabled])', nav);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  toggle.addEventListener('click', () => {
    if (nav.dataset.open === 'true') closeMenu();
    else openMenu();
  });

  document.addEventListener('click', (event) => {
    if (nav.dataset.open !== 'true') return;
    if (!nav.contains(event.target) && !toggle.contains(event.target)) closeMenu();
  });

  document.addEventListener('chrome:refresh', () => {
    closeMenu();
  });

  return header;
}

/** Build the footer. */
export function createFooter() {
  const footer = el('footer', { class: 'site-footer' });
  const container = el('div', { class: 'container' });

  const grid = el('div', { class: 'site-footer__grid' });

  const about = el('div', { class: 'site-footer__about' });
  about.append(createLogoLockup({ size: 24 }));
  about.append(el('p', { text: t('footer.about') }));
  grid.append(about);

  for (const column of FOOTER_COLUMNS) {
    const col = el('div', { class: 'site-footer__col' });
    col.append(el('h2', { class: 'site-footer__heading', text: t(column.title) }));
    const list = el('ul');
    for (const link of column.links) {
      const isExternal = link.href.startsWith('http');
      const anchor = el('a', {
        href: link.href,
        text: link.label || t(link.key),
        ...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
      });
      list.append(el('li', {}, [anchor]));
    }
    col.append(list);
    grid.append(col);
  }

  const bottom = el('div', { class: 'site-footer__bottom' }, [
    el('span', { text: `© ${new Date().getFullYear()} ContribMatch · ${t('footer.license')} · ${t('footer.rights')}` }),
    el('span', { class: 'cluster' }, [
      el('a', {
        href: REPO_URL,
        target: '_blank',
        rel: 'noopener noreferrer',
        text: t('footer.repo'),
      }),
      el('span', { text: '·' }),
      el('span', { text: t('footer.hackdays') }),
    ]),
  ]);

  container.append(grid, bottom);
  footer.append(container);
  return footer;
}

/** Which nav entry should be marked as the current page. */
/**
 * Which navigation item is the current page.
 *
 * Returns null when the page has no navigation entry of its own, so nothing
 * is marked as current rather than marking the wrong thing.
 * @returns {string|null}
 */
function currentPageId() {
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (file.startsWith('packs')) return 'packs';
  if (file.startsWith('docs')) return 'docs';
  if (file.startsWith('contribute')) return 'contribute';
  if (file.startsWith('index')) return 'home';
  return null;
}

/**
 * Whether the current page belongs to the matcher flow, which is reached
 * through the header button rather than a navigation item.
 * @returns {boolean}
 */
function isMatcherPage() {
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  return file.startsWith('app') || file.startsWith('issue') || file.startsWith('shortlist');
}

/**
 * Inject the header and footer.
 * @param {{headerId?: string, footerId?: string}} [opts]
 */
export function mountChrome({ headerId = 'site-header', footerId = 'site-footer' } = {}) {
  const headerSlot = document.getElementById(headerId);
  const footerSlot = document.getElementById(footerId);

  if (headerSlot) {
    const header = createHeader();
    headerSlot.replaceWith(header);
  }
  if (footerSlot) {
    const footer = createFooter();
    footerSlot.replaceWith(footer);
  }
}

export { currentPageId };
