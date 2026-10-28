/**
 * Docs page: sticky table of contents, copy buttons, and the settings form.
 */

import { el, qs, qsa, render } from './dom.js';
import { t } from './i18n.js';
import { showToast } from './toast.js';
import { attachCopyButtons } from './copy.js';
import { createSettings } from '../core/settings.js';
import { createCache } from '../github/cache.js';

const settings = createSettings();
const githubCache = createCache();

export function initDocsPage() {
  buildToc();
  attachCopyButtons(document);
  initSettingsForm();
}

function buildToc() {
  const tocHost = qs('#toc');
  const article = qs('#docs-article');
  if (!tocHost || !article) return;

  const headings = qsa('h2[id], h3[id]', article);
  if (!headings.length) return;

  const list = el('ul', { class: 'toc__list' });
  for (const heading of headings) {
    const item = el('li', { class: `toc__item toc__item--${heading.tagName.toLowerCase()}` });
    item.append(
      el('a', {
        href: `#${heading.id}`,
        text: heading.textContent,
      })
    );
    list.append(item);
  }

  render(tocHost, [
    el('p', { class: 'eyebrow', text: t('docs.toc') }),
    list,
  ]);

  // Highlight the section currently in view.
  const links = qsa('.toc__list a', tocHost);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      }
    },
    { rootMargin: '-88px 0px -70% 0px' }
  );
  headings.forEach((heading) => observer.observe(heading));
}

function initSettingsForm() {
  const form = qs('#settings-form');
  if (!form) return;

  const provider = qs('#setting-provider');
  const model = qs('#setting-model');
  const endpoint = qs('#setting-endpoint');
  const apiKey = qs('#setting-api-key');
  const token = qs('#setting-token');
  const useToken = qs('#setting-use-token');
  const mockMode = qs('#setting-mock');
  const status = qs('#settings-status');
  const current = settings.get();

  if (provider) provider.value = current.provider;
  if (model) model.value = current.model;
  if (endpoint) endpoint.value = current.endpoint;
  if (apiKey) apiKey.value = current.apiKey || '';
  if (token) token.value = current.token || '';
  if (useToken) useToken.checked = current.useToken;
  if (mockMode) mockMode.checked = current.mockMode;

  function refresh() {
    const isGoogle = provider?.value === 'google';
    if (endpoint) endpoint.disabled = isGoogle;
    if (model) model.disabled = provider?.value === 'mock';
    if (apiKey) apiKey.closest('.field')?.classList.toggle('is-hidden', !isGoogle);
  }
  refresh();
  provider?.addEventListener('change', refresh);
  token?.addEventListener('input', () => {
    if (useToken && token.value.trim()) useToken.checked = true;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    settings.set({
      provider: provider?.value || 'ollama',
      model: model?.value || 'gemma3:4b',
      endpoint: endpoint?.value || 'http://localhost:11434',
      apiKey: apiKey?.value || '',
      token: token?.value || '',
      // A pasted token is useless unless it is switched on, so pasting one
      // turns the switch on. Clear the token field to go back to anonymous.
      useToken: Boolean(token?.value) ? true : Boolean(useToken?.checked),
      mockMode: Boolean(mockMode?.checked),
    });
    // Cached GitHub responses were fetched under the previous auth state, so
    // changing the token invalidates them (public data only — no secrets).
    githubCache.invalidate();
    if (status) {
      status.textContent = 'Saved. Settings live in this browser only.';
      status.hidden = false;
    }
    showToast('Settings saved in this browser.', { type: 'success' });
  });

  qs('#settings-clear')?.addEventListener('click', () => {
    settings.clearSecrets();
    githubCache.invalidate();
    if (apiKey) apiKey.value = '';
    if (token) token.value = '';
    if (status) {
      status.textContent = 'The key and the token were removed from this tab.';
      status.hidden = false;
    }
    showToast('The key and the token were removed from this tab.', { type: 'success' });
  });
}
