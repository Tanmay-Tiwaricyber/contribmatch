/**
 * The matcher page.
 *
 * Runs the four agents, shows live steps, and renders the ranked shortlist
 * with filters and sorting. Everything happens in the browser.
 */

import { el, qs, qsa, render, relativeDate } from './dom.js';
import { t } from './i18n.js';
import { showToast } from './toast.js';
import { createStepsPanel } from './steps.js';
import { createProfileCard } from './profile-card.js';
import { showErrorDialog } from './error-dialog.js';
import { saveLastRun } from '../core/last-run.js';
import { createMatchCard, createState } from './match-card.js';
import { createMascot } from './mascot.js';
import { createSettings } from '../core/settings.js';
import { createShortlist } from '../core/shortlist.js';
import { createOrchestrator, clientFromSettings } from '../core/orchestrator.js';
import { createProvider, ProviderError } from '../core/provider.js';
import { createMockProvider } from '../core/mock/mock-provider.js';
import {
  createCache,
} from '../github/cache.js';
import { fetchCatalogue } from '../github/catalogue.js';
import {
  getGateStatus,
  getRateLimitStatus,
  subscribeGateStatus,
  subscribeRateLimit,
} from '../github/api.js';
import { formatNumber } from './dom.js';
import { validateLogin } from '../github/normalize.js';

const cache = createCache();
const settings = createSettings();
const shortlist = createShortlist();

/** Build the provider described by the current settings. */
export function buildProvider(current) {
  if (current.mockMode || current.provider === 'mock') {
    return createMockProvider();
  }
  if (current.provider === 'google') {
    if (!current.apiKey) {
      throw new ProviderError('Add a Google AI Studio key in the docs page first.', {
        kind: 'config',
      });
    }
    return createProvider({ provider: 'google', apiKey: current.apiKey, model: current.model });
  }
  if (current.provider === 'openrouter' || current.provider === 'groq') {
    if (!current.apiKey) {
      throw new ProviderError(
        current.provider === 'openrouter'
          ? 'Add an OpenRouter key in the docs page first.'
          : 'Add a Groq key in the docs page first.',
        { kind: 'config' }
      );
    }
    return createProvider({ provider: current.provider, apiKey: current.apiKey, model: current.model });
  }
  return createProvider({
    provider: 'ollama',
    endpoint: current.endpoint,
    model: current.model,
  });
}

export function initAppPage() {
  const form = qs('#matcher-form');
  const input = qs('#matcher-username');
  const errorBox = qs('#matcher-error');
  const resultsHost = qs('#results');
  const stepsHost = qs('#steps-host');
  const filtersHost = qs('#filters');
  const metaHost = qs('#results-meta');
  const runBtn = qs('#run-button');
  const profileHost = qs('#profile-host');
  const profileSection = qs('#profile-section');

  /** The public profile the run read, rendered next to the results. */
  function renderProfile(profile, profileResult = {}) {
    if (!profileHost || !profileSection) return;
    if (!profile || !(profile.login || profile.name)) {
      profileSection.hidden = true;
      render(profileHost, []);
      return;
    }
    profileSection.hidden = false;
    render(profileHost, [createProfileCard(profile, { level: profileResult.level, levelLabel: profileResult.levelLabel })]);
  }

  if (!form || !input || !resultsHost) return;

  const panel = createStepsPanel();
  if (stepsHost) stepsHost.replaceWith(panel.element);

  // --- GitHub API status chip (queue + rate limits, no secrets shown) ------
  const apiStatusText = el('span');
  const catalogueChip = el('span', { class: 'mono small muted' });
  const apiStatusHost = el('div', {
    class: 'mono small muted api-status',
    role: 'status',
    'aria-live': 'polite',
  });
  metaHost?.parentNode?.insertBefore(apiStatusHost, metaHost);
  apiStatusHost.append(apiStatusText, ' ', catalogueChip);
  let apiStatusTimer = null;

  // Catalogue freshness (Layer A): every visitor can start from the static
  // catalogue; this chip says where the issue data came from.
  (async () => {
    const cat = await fetchCatalogue({});
    if (!cat.ok) {
      catalogueChip.textContent = `· ${t('app.catalogue.absent')}`;
      return;
    }
    const minutes = Math.round((cat.ageMs || 0) / 60000);
    const age =
      minutes <= 1
        ? t('app.catalogue.justNow')
        : t('app.catalogue.refreshed', { count: formatNumber(cat.issues.length), minutes: formatNumber(minutes) });
    catalogueChip.textContent = `· ${t('app.catalogue.title')}: ${age}${cat.stale ? ` (${t('app.catalogue.stale')})` : ''}`;
  })();

  function renderApiStatus() {
    if (!apiStatusText) return;
    const gate = getGateStatus();
    const limits = getRateLimitStatus();
    if (gate.paused && gate.pausedUntilMsLeft != null) {
      const reason =
        gate.pauseReason === 'primary-rate-limit'
          ? t('app.api.paused.rate-limit')
          : gate.pauseReason === 'secondary-rate-limit'
            ? t('app.api.paused.rate-limit')
            : t('app.api.paused.network');
      apiStatusText.textContent = `${t('app.api.title')}: ${t('app.api.paused', {
        seconds: Math.ceil(gate.pausedUntilMsLeft / 1000),
        reason,
      })}`;
      if (apiStatusTimer) clearTimeout(apiStatusTimer);
      apiStatusTimer = setTimeout(renderApiStatus, 1000);
      return;
    }
    const parts = [];
    for (const bucket of ['core', 'search', 'graphql']) {
      const info = limits[bucket];
      if (info && info.remaining != null && info.limit != null) {
        parts.push(`${bucket} ${info.remaining}/${info.limit}`);
      }
    }
    if (gate.pending) parts.push(t('app.api.queued', { count: gate.pending }));
    apiStatusText.textContent = parts.length
      ? `${t('app.api.title')}: ${parts.join(' · ')}`
      : `${t('app.api.title')}: ${t('app.api.ready')}`;
  }

  const unsubStatus = subscribeGateStatus(renderApiStatus);
  const unsubLimits = subscribeRateLimit(renderApiStatus);
  renderApiStatus();
  // Stop the chip's countdown timer and listeners when the page is replaced.
  window.addEventListener('pagehide', () => {
    unsubStatus();
    unsubLimits();
    if (apiStatusTimer) clearTimeout(apiStatusTimer);
  });

  const state = {
    issues: [],
    sort: 'score',
    language: '',
    label: '',
    running: false,
    lastLogin: '',
    stale: false,
  };

  // --- Shortlist sync ------------------------------------------------------
  function savedIds() {
    return new Set(shortlist.list().map((item) => String(item.id)));
  }

  function renderResults() {
    if (!state.issues.length) {
      render(resultsHost, [
        createState({
          mood: 'sleepy',
          title: t('app.empty.title'),
          body: t('app.empty.body'),
        }),
      ]);
      render(metaHost, []);
      return;
    }

    const saved = savedIds();
    let list = state.issues.slice();

    if (state.language) {
      list = list.filter((issue) => (issue.language || '').toLowerCase() === state.language.toLowerCase());
    }
    if (state.label) {
      list = list.filter((issue) => (issue.labels || []).includes(state.label));
    }

    if (state.sort === 'fresh') {
      list.sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0));
    } else if (state.sort === 'effort') {
      const effortRank = { 'About 2 to 4 hours': 2, 'About an hour': 1 };
      list.sort(
        (a, b) =>
          (effortRank[a.effort] ?? 3) - (effortRank[b.effort] ?? 3) || b.score - a.score
      );
    } else {
      list.sort((a, b) => b.score - a.score);
    }

    render(metaHost, [
      el('span', {
        class: 'mono small muted',
        text: `${list.length} ${list.length === 1 ? t('common.issue') : t('common.issues')}`,
      }),
    ]);

    if (!list.length) {
      render(resultsHost, [
        createState({
          mood: 'sleepy',
          title: t('app.empty.title'),
          body: t('app.empty.body'),
        }),
      ]);
      return;
    }

    render(
      resultsHost,
      list.map((issue) =>
        createMatchCard(issue, {
          saved: saved.has(String(issue.id)),
          onSave: (target) => {
            const result = shortlist.toggle(target);
            showToast(result.added ? t('app.saved') : t('shortlist.remove'), {
              type: result.added ? 'success' : 'info',
            });
            renderResults();
          },
        })
      )
    );
  }

  // --- Filters -------------------------------------------------------------
  function renderFilters() {
    if (!filtersHost) return;
    // The filter options come from the results, so with no results there is
    // nothing to filter. Hide the panel rather than show an empty shell.
    const card = qs('#filters-card');
    if (card) card.hidden = state.issues.length === 0;
    const languages = Array.from(
      new Set(state.issues.map((issue) => issue.language).filter(Boolean))
    ).sort();
    const labels = Array.from(new Set(state.issues.flatMap((issue) => issue.labels || []))).sort();

    const languageSelect = el('select', { class: 'select', id: 'filter-language' }, [
      el('option', { value: '', text: t('app.filterAll') }),
      ...languages.map((lang) => el('option', { value: lang, text: lang })),
    ]);
    languageSelect.value = state.language;

    const labelSelect = el('select', { class: 'select', id: 'filter-label' }, [
      el('option', { value: '', text: t('app.filterAll') }),
      ...labels.map((label) => el('option', { value: label, text: label })),
    ]);
    labelSelect.value = state.label;

    const sortSelect = el('select', { class: 'select', id: 'sort-by' }, [
      el('option', { value: 'score', text: t('app.sort.score') }),
      el('option', { value: 'fresh', text: t('app.sort.fresh') }),
      el('option', { value: 'effort', text: t('app.sort.effort') }),
    ]);
    sortSelect.value = state.sort;

    languageSelect.addEventListener('change', () => {
      state.language = languageSelect.value;
      renderResults();
    });
    labelSelect.addEventListener('change', () => {
      state.label = labelSelect.value;
      renderResults();
    });
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      renderResults();
    });

    render(filtersHost, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'filter-language', text: t('app.filterLanguage') }),
        languageSelect,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'filter-label', text: t('app.filterLabel') }),
        labelSelect,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'sort-by', text: t('app.sort') }),
        sortSelect,
      ]),
    ]);
  }

  // --- Run -----------------------------------------------------------------
  function showError(message, kind = 'error') {
    if (!errorBox) return;
    errorBox.hidden = !message;
    errorBox.textContent = message || '';
    if (message) {
      const mascot = createMascot({ mood: kind === 'rate-limit' ? 'oops' : 'oops', size: 'sm' });
      render(errorBox, [mascot, el('span', { text: message })]);
    }
  }

  async function run(login) {
    if (state.running) return;
    state.running = true;
    state.lastLogin = login || '';
    panel.reset();
    errorBox?.setAttribute('hidden', '');

    const current = settings.get();
    const mock = current.mockMode || current.provider === 'mock';

    if (runBtn) {
      runBtn.dataset.loading = 'true';
      runBtn.disabled = true;
      runBtn.textContent = t('app.running');
    }

    render(resultsHost, [
      el('div', { class: 'stack' }, [
        el('div', { class: 'skeleton skeleton--card' }),
        el('div', { class: 'skeleton skeleton--card' }),
        el('div', { class: 'skeleton skeleton--card' }),
      ]),
    ]);
    if (profileSection) profileSection.hidden = true;

    let provider = null;
    let providerError = null;
    try {
      provider = buildProvider(current);
    } catch (err) {
      providerError = err;
    }

    const client = clientFromSettings(current);
    const orchestrator = createOrchestrator({
      provider,
      mock,
      client,
      cache,
      // Layer A — data/issues.json lets the matcher start with zero GitHub
      // requests when the catalogue is fresh.
      catalogue: { url: 'data/issues.json' },
    });

    try {
      const result = await orchestrator.match(
        { login: mock ? null : login, limit: 30 },
        { onStep: (message) => panel.onStep(message) }
      );

      state.issues = result.issues;
      panel.finish();

      // Keep the last run locally so the issue page can show a plan for
      // something you did not save to the shortlist, even in a new tab.
      saveLastRun(result.issues);

      state.stale = result.issues.some((issue) => issue.stale);
      renderProfile(result.profile, result.profileResult);
      if (providerError) {
        // The provider was configured but could not be built (missing AI
        // Studio key); the run finished with rule scores only.
        showErrorDialog(providerError);
        showError(providerError.message);
      } else if (result.rankedSource === 'fallback') {
        // Not a failure: the rule engine scored everything. The only thing
        // lost is the model's refinement of the top 8, so say so as a warning
        // and include the model's real failure reason for the curious.
        const reason = result.rankedError ? ` (${result.rankedError})` : '';
        showError(`${t('app.source.fallback')}${reason}`, 'warn');
      } else if (state.stale) {
        showError(t('app.api.stale'), 'warn');
      }

      renderFilters();
      renderResults();

      // Sample banner
      const banner = qs('#sample-banner');
      if (banner) banner.hidden = !mock;
    } catch (err) {
      panel.fail(err.message);

      // A real failure gets a red-alert dialog that names what is missing
      // and what to do — plus the inline mascot state for the results area.
      showErrorDialog(err, { onRetry: state.lastLogin ? () => run(state.lastLogin) : null });

      const isBadToken = err.kind === 'bad-token';
      const isRateLimit = err.kind === 'rate-limit' || isBadToken;
      const action = el('a', {
        class: 'btn btn--primary btn--sm',
        href: 'docs.html#token',
        text: t('app.rateLimit.addToken'),
      });
      const children = [
        createState({
          mood: 'oops',
          title: isBadToken
            ? t('app.badToken.title')
            : isRateLimit ? t('app.rateLimit.title') : t('app.error.title'),
          body: isBadToken
            ? t('app.badToken.body')
            : isRateLimit ? t('app.rateLimit.body') : `${t('app.error.body')} (${err.message})`,
          action: isRateLimit ? action : null,
        }),
      ];
      // Failures here are almost always temporary: offer one retry click.
      if (state.lastLogin) {
        children.push(
          el('div', { class: 'cluster', style: { justifyContent: 'center' } }, [
            el('button', {
              class: 'btn btn--primary',
              type: 'button',
              text: t('app.api.retry'),
              onclick: () => run(state.lastLogin),
            }),
          ])
        );
      }
      render(resultsHost, children);
    } finally {
      state.running = false;
      if (runBtn) {
        runBtn.dataset.loading = 'false';
        runBtn.disabled = false;
        runBtn.textContent = t('app.run');
      }
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const login = input.value.trim();
    const current = settings.get();
    const mock = current.mockMode || current.provider === 'mock';

    if (!mock) {
      const validation = validateLogin(login);
      if (!validation.valid) {
        showError(validation.error);
        input.focus();
        return;
      }
    }
    showError('');
    run(login);
  });

  // Auto-run when a username arrives in the URL.
  const params = new URLSearchParams(location.search);
  const userParam = params.get('user');
  if (userParam) {
    input.value = userParam;
    run(userParam);
  }

  // Re-render when the shortlist changes in another tab.
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.includes('shortlist')) renderResults();
  });

  document.addEventListener('languagechange', () => {
    renderFilters();
    renderResults();
  });
}

export { shortlist, settings };
