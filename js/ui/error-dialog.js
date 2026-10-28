/**
 * A red-alert error dialog.
 *
 * Every hard failure on the matcher page (rate limit, rejected token,
 * unreachable model, offline GitHub, queue overflow) opens a modal that
 * answers the three questions the old inline error left implicit:
 *
 *   1. what failed — in plain language, naming the exact missing piece;
 *   2. why it can be trusted (nothing was faked, no retries were skipped);
 *   3. what to do next — a concrete action button, never a dead end.
 *
 * Built on `openModal`, so focus is trapped, Escape/backdrop close it, and
 * focus returns to the page. All text goes through the i18n layer.
 */

import { el } from './dom.js';
import { t } from './i18n.js';
import { openModal } from './modal.js';

/** Docs links for each family of failure. */
const LINKS = {
  token: 'docs.html#token',
  ollama: 'docs.html#ollama',
  aiStudio: 'docs.html#ai-studio',
  troubleshooting: 'docs.html#troubleshooting',
};

function minutesUntil(resetAt) {
  if (!Number.isFinite(resetAt)) return null;
  return Math.max(1, Math.round((resetAt - Date.now()) / 60000));
}

/**
 * @param {object} err anything thrown (GitHubError, ProviderError, plain Error)
 * @returns {{kind: string, title: string, cause: string, hints: string[], action?: {label: string, href: string}}}
 */
export function classifyError(err = {}) {
  const message = typeof err.message === 'string' ? err.message : String(err?.message || '');
  switch (err.kind) {
    case 'rate-limit': {
      const bucket =
        err.limitType === 'primary'
          ? t('app.errorDialog.bucket.core')
          : t('app.errorDialog.bucket.search');
      const minutes = minutesUntil(err.resetAt);
      const when = minutes
        ? t('app.errorDialog.rateLimitCause', { bucket, minutes })
        : t('app.errorDialog.rateLimitGeneric', { bucket });
      return {
        kind: 'rate-limit',
        title: t('app.rateLimit.title'),
        cause: when,
        hints: [t('app.rateLimit.body')],
        action: { label: t('app.rateLimit.addToken'), href: LINKS.token },
      };
    }
    case 'bad-token':
      return {
        kind: 'bad-token',
        title: t('app.badToken.title'),
        cause: message || t('app.badToken.body'),
        hints: [t('app.badToken.body')],
        action: { label: t('app.rateLimit.addToken'), href: LINKS.token },
      };
    case 'not-found':
      return {
        kind: 'not-found',
        title: t('app.errorDialog.notFound.title'),
        cause: message || t('app.errorDialog.notFound.cause'),
        hints: [
          t('app.errorDialog.notFound.hint'),
          t('app.errorDialog.hint.mock'),
        ],
        action: null,
      };
    case 'config':
      return {
        kind: 'config',
        title: t('app.errorDialog.config.title'),
        cause: message,
        hints: [
          {
            text: t('app.errorDialog.config.hint.ollama'),
            href: LINKS.ollama,
            linkText: t('app.errorDialog.config.link.ollama'),
          },
          {
            text: t('app.errorDialog.config.hint.key'),
            href: LINKS.aiStudio,
            linkText: t('app.errorDialog.config.link.aiStudio'),
          },
          t('app.errorDialog.hint.mock'),
        ],
        action: { label: t('app.errorDialog.action.setup'), href: LINKS.troubleshooting },
      };
    case 'queue-full':
      return {
        kind: 'queue-full',
        title: t('app.errorDialog.queueFull.title'),
        cause: message || t('app.errorDialog.queueFull.cause'),
        hints: [t('app.errorDialog.hint.wait')],
        action: null,
      };
    case 'network':
      return {
        kind: 'network',
        title: t('app.error.title'),
        cause: message || t('app.error.body'),
        hints: [t('app.error.body'), t('app.errorDialog.hint.wait')],
        action: null,
      };
    case 'server':
      return {
        kind: 'server',
        title: t('app.errorDialog.server.title'),
        cause: message || t('app.errorDialog.server.cause'),
        hints: [t('app.errorDialog.hint.wait')],
        action: null,
      };
    default:
      return {
        kind: 'unknown',
        title: t('app.errorDialog.something.title'),
        cause: message || t('app.errorDialog.something.cause'),
        hints: [t('app.errorDialog.hint.details'), t('app.errorDialog.hint.wait')],
        action: { label: t('app.errorDialog.action.trouble'), href: LINKS.troubleshooting },
      };
  }
}

/** One hint from classifyError: plain text, or text + a docs link. */
function hintNode(hint) {
  if (typeof hint === 'string') return el('li', { text: hint });
  // Keep this a flat array: el() stringifies nested arrays of children.
  const children = [el('span', { text: hint.text })];
  if (hint.href) {
    children.push(' ', el('a', { href: hint.href, text: hint.linkText || hint.href }));
  }
  return el('li', {}, children);
}

/**
 * Open the alert dialog for an error. Never throws.
 * @param {object} err the thrown error
 * @param {{onRetry?: () => void}} [opts]
 * @returns {{close: () => void, kind: string}|null} null when the dialog could not open
 */
export function showErrorDialog(err, { onRetry } = {}) {
  let info;
  try {
    info = classifyError(err);
  } catch {
    return null;
  }

  const actions = [];
  if (info.action) {
    actions.push(
      el('a', { class: 'btn btn--primary btn--sm', href: info.action.href, text: info.action.label })
    );
  }

  const alert = el('div', { class: 'notice notice--danger', role: 'alert' }, [
    el('span', { class: 'notice__icon', 'aria-hidden': 'true', text: '!' }),
    el('p', { text: info.cause }),
  ]);

  const hints = info.hints.length
    ? el('div', { class: 'stack', style: { gap: 'var(--sp-2)' } }, [
        el('p', { class: 'small muted', text: t('app.errorDialog.howToFix') }),
        el('ul', { class: 'error-dialog__hints' }, info.hints.map(hintNode)),
      ])
    : null;

  let modal;
  try {
    modal = openModal({
      title: info.title,
      body: el('div', { class: 'stack' }, [
        alert,
        hints,
      ]),
      actions,
      size: 'sm',
      labelClose: t('app.errorDialog.close'),
    });
  } catch {
    return null;
  }

  // The retry lives in the footer after the modal exists, so one click
  // closes the dialog and re-runs the matcher. `openModal` only renders a
  // footer when there was a pre-existing action, so create one if needed.
  if (typeof onRetry === 'function') {
    const dialogEl = modal.element.querySelector('.modal__dialog');
    let foot = modal.element.querySelector('.modal__foot');
    if (!foot && dialogEl) {
      foot = el('div', { class: 'modal__foot' });
      dialogEl.append(foot);
    }
    if (foot) {
      foot.append(
        el('button', {
          class: 'btn btn--secondary btn--sm',
          type: 'button',
          text: t('app.api.retry'),
          onclick: () => {
            modal.close();
            onRetry();
          },
        })
      );
    }
  }

  return { close: modal.close, kind: info.kind };
}
