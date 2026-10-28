/**
 * Page bootstrap.
 *
 * Every page includes this module. It sets up the theme and language, injects
 * the shared header and footer, then runs the controller for that page.
 */

import { initTheme } from './ui/theme.js';
import { initLanguage } from './ui/i18n.js';
import { mountChrome } from './ui/chrome.js';

const PAGES = {
  home: () => import('./ui/home.js').then((m) => m.initHome()),
  app: () => import('./ui/app-page.js').then((m) => m.initAppPage()),
  issue: () => import('./ui/issue-page.js').then((m) => m.initIssuePage()),
  shortlist: () => import('./ui/shortlist-page.js').then((m) => m.initShortlistPage()),
  packs: () => import('./ui/packs-page.js').then((m) => m.initPacksPage()),
  docs: () => import('./ui/docs-page.js').then((m) => m.initDocsPage()),
  design: () => import('./ui/design-system-page.js').then((m) => m.initDesignSystemPage()),
};

function boot() {
  initTheme();
  initLanguage();
  mountChrome();

  const page = document.body?.dataset.page || 'home';
  const controller = PAGES[page];
  if (!controller) return;

  controller().catch((err) => {
    // A failure in a page controller must not leave the page blank.
    console.error('[contribmatch] page controller failed:', err);
    const host = document.querySelector('[data-page-error]');
    if (host) {
      host.hidden = false;
      host.textContent = `Something went wrong on this page: ${err.message}`;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
