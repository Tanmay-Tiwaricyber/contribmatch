/**
 * Landing page: hero form and the contribution activity panel.
 *
 * The panel works in all three data modes — sample before a username is
 * entered, approximate from public events, exact with a token.
 */

import { el, qs, render } from './dom.js';
import { t } from './i18n.js';
import { showToast } from './toast.js';
import { createHeatmap, createBreakdown } from './heatmap.js';
import { createMascot } from './mascot.js';
import { createHeroScene } from './hero-scene.js';
import { createGitHubClient } from '../github/api.js';
import { getContributions, sourceLabel, sourceNote } from '../github/contributions.js';
import { validateLogin } from '../github/normalize.js';
import { createCache } from '../github/cache.js';
import { createSettings } from '../core/settings.js';
import { buildSampleContributions } from '../core/mock/mock-data.js';
import { createOrchestrator, mockContributions } from '../core/orchestrator.js';
import { createMockProvider } from '../core/mock/mock-provider.js';

const cache = createCache();
const settings = createSettings();

/**
 * @param {{settings?: object}} [opts]
 */
export function initHome(opts = {}) {
  const form = qs('#hero-form');
  const input = qs('#hero-username');
  const errorBox = qs('#hero-error');
  const activityHost = qs('#activity-panel');
  const ctaHost = qs('#hero-cta');

  if (!form || !input || !activityHost) return;

  const state = { login: '', source: 'sample' };

  // --- The 3D scene behind the hero ---------------------------------------
  // It is built from the same contribution data as the panel below, so the
  // wall shows real activity rather than a decorative loop.
  const sceneHost = qs('#hero-scene');
  const marqueeHost = qs('#hero-marquee');

  function renderMarquee() {
    if (!marqueeHost) return;
    const items = String(t('home.marquee') || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!items.length) return;
    // Two identical tracks make the loop seamless.
    render(marqueeHost, [
      el('div', { class: 'marquee__set' }, items.map((label) =>
        el('span', { class: 'marquee__item', text: label })
      )),
      el('div', { class: 'marquee__set', 'aria-hidden': 'true' }, items.map((label) =>
        el('span', { class: 'marquee__item', text: label })
      )),
    ]);
  }

  function renderScene(contributions) {
    if (!sceneHost) return;
    render(sceneHost, [
      createHeroScene({
        ...contributions,
        sourceLabel: sourceLabel(contributions.source),
      }),
    ]);
  }

  // --- Activity panel ------------------------------------------------------
  async function renderActivity() {
    render(activityHost, [el('p', { class: 'activity__note', text: t('activity.loading') })]);

    const mock = settings.get().mockMode;
    let contributions;
    try {
      if (mock || !state.login) {
        contributions = mockContributions(371);
      } else {
        const current = settings.get();
        const client = createGitHubClient({ token: current.useToken ? current.token : null });
        contributions = await getContributions({
          client,
          login: state.login,
          token: current.useToken ? current.token : null,
          cache,
        });
      }
    } catch (err) {
      render(activityHost, [
        el('div', { class: 'notice notice--danger' }, [
          el('span', { class: 'notice__icon', text: '!' }),
          el('p', { text: err.message }),
        ]),
      ]);
      return;
    }

    state.source = contributions.source;
    const totals = contributions.totals || {};
    renderScene(contributions);

    const source = el('span', {
      class: 'activity__source',
      text: sourceLabel(contributions.source),
    });

    // The graph shows the window the data actually covers, so it never
    // implies a full year when the data is only an approximation.
    const maxWeeks =
      contributions.source === 'events' ? 13 : contributions.source === 'sample' ? 26 : 53;

    const heat = createHeatmap({
      days: contributions.days,
      source: contributions.source,
      maxWeeks,
      labels: {
        less: t('activity.less'),
        more: t('activity.more'),
        summary: t('activity.summary'),
        tableCaption: t('activity.tableCaption'),
      },
    });

    const breakdown = createBreakdown({
      byType: {
        commits: totals.commits,
        pullRequests: totals.pullRequests,
        issues: totals.issues,
        reviews: totals.reviews,
      },
      labels: {
        commits: t('activity.commits'),
        pullRequests: t('activity.pullRequests'),
        issues: t('activity.issues'),
        reviews: t('activity.reviews'),
      },
    });

    const note = el('p', { class: 'activity__note', text: sourceNote(contributions.source) });

    const children = [
      el('div', { class: 'activity__head' }, [
        el('h2', { class: 'activity__title', text: t('activity.title') }),
        source,
      ]),
      heat,
      breakdown,
      note,
    ];

    // One-line takeaway — model first, rule-based fallback.
    const takeawayBox = el('div', { class: 'activity__takeaway' });
    children.push(takeawayBox);
    render(activityHost, children);

    const orchestrator = createOrchestrator({
      mock,
      provider: mock ? createMockProvider() : null,
    });
    orchestrator
      .activityTakeaway(contributions)
      .then((result) => {
        render(takeawayBox, [
          el('strong', { text: t('activity.takeaway') }),
          el('span', { text: result.takeaway }),
        ]);
      })
      .catch(() => {
        render(takeawayBox, [
          el('strong', { text: t('activity.takeaway') }),
          el('span', { text: '—' }),
        ]);
      });
  }

  // --- Hero form -----------------------------------------------------------
  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = input.value.trim();
    const validation = validateLogin(login);
    if (!validation.valid) {
      showError(validation.error);
      input.focus();
      return;
    }
    showError('');
    state.login = login;

    const submit = qs('#hero-submit');
    if (submit) {
      submit.dataset.loading = 'true';
      submit.disabled = true;
    }
    await renderActivity();
    if (submit) {
      submit.dataset.loading = 'false';
      submit.disabled = false;
    }
    if (ctaHost) {
      render(ctaHost, [
        el('a', {
          class: 'btn btn--primary btn--lg',
          href: `app.html?user=${encodeURIComponent(login)}`,
          text: t('app.run'),
        }),
      ]);
    }
  });

  input.addEventListener('input', () => {
    if (errorBox && !errorBox.hidden) showError('');
  });

  // --- Initial render ------------------------------------------------------
  renderMarquee();
  renderActivity();

  // The mascot in the hero reacts to the state of the page.
  const mascotHost = qs('#hero-mascot');
  if (mascotHost) {
    const mascot = createMascot({ mood: 'idle', size: 'md' });
    render(mascotHost, [mascot]);
    form.addEventListener('submit', () => mascot.dataset.mood = 'thinking');
    form.addEventListener('input', () => mascot.dataset.mood = 'idle');
  }
}

export { buildSampleContributions };
