/**
 * GitHub profile card.
 *
 * Renders the public profile the matcher already read — avatar, name, bio,
 * account stats, top languages and recently pushed repositories. Built with
 * the `el()` helper (textContent only) and the existing design-system
 * classes, so it works in light, dark and every language.
 */

import { el, formatNumber, relativeDate } from './dom.js';
import { t } from './i18n.js';

function initials(profile) {
  const source = profile.name || profile.login || '?';
  return source.trim().charAt(0).toUpperCase() || '?';
}

function statChip(icon, value, labelKey) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return el('span', { class: 'chip', title: t(labelKey) }, [
    el('strong', { text: formatNumber(n) }),
    ` ${t(labelKey)}`,
  ]);
}

function languageRow(lang, share) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(share) || 0)));
  return el('div', { class: 'profile-card__lang' }, [
    el('span', { class: 'mono small', text: `${lang} · ${pct}%` }),
    el('div', { class: 'profile-card__bar', role: 'presentation' }, [
      el('div', { class: 'profile-card__fill', style: { width: `${Math.max(pct, 3)}%` } }),
    ]),
  ]);
}

/**
 * @param {object} profile the normalised public profile
 * @param {{level?: number, levelLabel?: string}} [extras]
 * @returns {HTMLElement|null} null when there is nothing truthful to show
 */
export function createProfileCard(profile = {}, extras = {}) {
  if (!profile || !(profile.login || profile.name)) return null;

  const languages = Object.entries(profile.languages || {})
    .filter(([, share]) => Number(share) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const repos = (profile.repos || []).slice(0, 4);
  const loginUrl = profile.login ? `https://github.com/${encodeURIComponent(profile.login)}` : '';

  // The avatar: the user's real profile picture when one exists, otherwise a
  // neutral initial block (never a fake face).
  const avatar = profile.avatarUrl
    ? el('img', {
        class: 'profile-card__avatar',
        src: profile.avatarUrl,
        alt: '',
        width: '56',
        height: '56',
        loading: 'lazy',
      })
    : el('div', { class: 'profile-card__avatar profile-card__avatar--initial', 'aria-hidden': 'true', text: initials(profile) });

  const head = [
    avatar,
    el('div', {}, [
      el('p', { class: 'card__title', style: { margin: 0 }, text: profile.name || profile.login }),
      profile.login
        ? el('a', {
            class: 'mono small muted',
            href: loginUrl,
            rel: 'noopener noreferrer',
            target: '_blank',
            text: `@${profile.login}`,
          })
        : null,
    ]),
  ];
  if (extras.levelLabel) {
    head.push(el('span', { class: 'chip', text: extras.levelLabel }));
  }

  const stats = [
    statChip('repo', profile.publicRepos, 'app.profile.repos'),
    statChip('follower', profile.followers, 'app.profile.followers'),
    statChip('star', profile.totalStars, 'app.profile.stars'),
  ].filter(Boolean);

  const children = [
    el('div', { class: 'cluster', style: { alignItems: 'center' } }, head),
    profile.bio ? el('p', { class: 'card__body', text: profile.bio }) : null,
    profile.createdAt
      ? el('p', {
          class: 'mono small muted',
          text: `${t('app.profile.since')} ${relativeDate(profile.createdAt)}`,
        })
      : null,
    stats.length ? el('div', { class: 'cluster' }, stats) : null,
    languages.length
      ? el('div', { class: 'stack', style: { gap: 'var(--sp-2)' } }, [
          el('p', { class: 'small muted', text: t('app.profile.languages') }),
          el('div', { class: 'stack', style: { gap: 'var(--sp-1)' } }, languages.map(([lang, share]) => languageRow(lang, share))),
        ])
      : null,
    repos.length
      ? el('div', { class: 'stack', style: { gap: 'var(--sp-2)' } }, [
          el('p', { class: 'small muted', text: t('app.profile.recentRepos') }),
          el('ul', { class: 'profile-card__repos' }, repos.map((repo) =>
            el('li', {}, [
              repo.name
                ? el('a', {
                    href: `https://github.com/${encodeURIComponent(profile.login)}/${encodeURIComponent(repo.name)}`,
                    rel: 'noopener noreferrer',
                    target: '_blank',
                    text: repo.name,
                  })
                : el('strong', { text: repo.name || '—' }),
              ` ${repo.language || '—'} · ${formatNumber(repo.stars || 0)}★`,
            ])
          )),
        ])
      : null,
  ].filter(Boolean);

  return el('div', { class: 'card card--raised' }, [
    el('div', { class: 'card__body' }, [
      el('h2', { class: 'card__title', 'data-i18n': 'app.profile.title', text: t('app.profile.title') }),
      el('div', { class: 'stack', style: { gap: 'var(--sp-3)' } }, children),
    ]),
  ]);
}
