/**
 * Orchestrator — the whole matching flow.
 *
 *   profile -> scout -> rank -> (per issue) coach + quality guard
 *
 * The orchestrator owns no DOM code. It receives a context object with
 * `onStep` and returns plain data. The UI layer renders it.
 */

import {
  createProfileAgent,
  createScoutAgent,
  createRankerAgent,
  createCoachAgent,
  createQualityGuardAgent,
  createActivityTakeawayAgent,
} from './agents.js';
import { searchIssues, mockSearchIssues } from '../github/issues.js';
import { createGitHubClient } from '../github/api.js';
import { fetchProfile } from '../github/profile.js';
import {
  fetchCatalogue,
  eligibleFromCatalogue,
  issuesFromCatalogue,
} from '../github/catalogue.js';
import { MOCK_ISSUES, MOCK_PROFILE, buildSampleContributions } from './mock/mock-data.js';
import { sampleContributions } from '../github/contributions.js';

/**
 * @param {{provider?: object, mock?: boolean, client?: object, cache?: object, search?: Function, catalogue?: {url?: string, maxAgeMs?: number}|null}} deps
 */
export function createOrchestrator(deps = {}) {
  const {
    provider = null,
    mock = false,
    client = null,
    cache = null,
    search = null,
    catalogue = null,
  } = deps;

  const profileAgent = createProfileAgent({ provider });
  const scoutAgent = createScoutAgent({
    provider,
    search: search || (mock ? mockScout : realScout),
  });
  const rankerAgent = createRankerAgent({ provider });
  const coachAgent = createCoachAgent({ provider });
  const qualityGuardAgent = createQualityGuardAgent({ provider });
  const activityAgent = createActivityTakeawayAgent({ provider });

  async function realScout({ languages, limit, signal }) {
    if (!client && !catalogue) throw new Error('No GitHub client is configured.');

    // Layer A — the static catalogue first: zero GitHub requests for a fresh
    // catalogue, so repeat visitors never wait on the API queue.
    let cat = null;
    if (catalogue?.url) {
      cat = await fetchCatalogue({ url: catalogue.url, maxAgeMs: catalogue.maxAgeMs });
      if (cat.ok) {
        const issues = eligibleFromCatalogue(
          issuesFromCatalogue(cat.issues, { languages }),
          { languages, limit }
        );
        if (!cat.stale && issues.length) {
          return issues.map((issue) => ({
            ...issue,
            dataSource: 'catalogue',
          }));
        }
      }
    }

    // Layer B/C — live search through the shared queue and TTL cache.
    try {
      return await searchIssues(client, {
        languages,
        limit,
        signal,
        cache,
        maxRepoLookups: client.hasToken ? undefined : 5,
      });
    } catch (err) {
      // Rate-limited or offline: the stale catalogue is still real, verified
      // data — clearly flagged instead of an empty page.
      if (cat && cat.ok) {
        const issues = eligibleFromCatalogue(
          issuesFromCatalogue(cat.issues, { languages }),
          { languages, limit }
        );
        if (issues.length) {
          return issues.map((issue) => ({
            ...issue,
            stale: true,
            dataSource: 'catalogue-stale',
          }));
        }
      }
      throw err;
    }
  }

  function mockScout({ languages, limit }) {
    return Promise.resolve(mockSearchIssues({ languages, limit }, MOCK_ISSUES));
  }

  return {
    agents: { profileAgent, scoutAgent, rankerAgent, coachAgent, qualityGuardAgent, activityAgent },

    /**
     * Read a public profile and infer skills and level.
     * @param {{login: string, signal?: AbortSignal}} input
     */
    async readProfile(input, ctx = {}) {
      const profile = mock
        ? { ...MOCK_PROFILE }
        : await fetchProfile(client, input.login, { signal: input.signal, cache });
      const result = await profileAgent.run({ profile }, ctx);
      return { profile, ...result };
    },

    /**
     * The full matching run.
     * @param {{login?: string, languages?: string[], limit?: number, signal?: AbortSignal}} input
     */
    async match(input, ctx = {}) {
      const { login, languages = [], limit = 30, signal } = input;

      // 1 — Profile
      let profileResult;
      if (mock) {
        const profile = { ...MOCK_PROFILE };
        profileResult = await profileAgent.run({ profile }, ctx);
        profileResult = { profile, ...profileResult };
      } else if (login) {
        profileResult = await this.readProfile({ login, signal }, ctx);
      } else {
        profileResult = {
          profile: { languages: [], skills: [], level: 0, topics: [] },
          level: 0,
          skills: [],
          languages: [],
          summary: 'No profile was loaded.',
          source: 'rules',
        };
      }

      // 2 — Scout
      const wantedLanguages = languages.length
        ? languages
        : (profileResult.languages || []).slice(0, 3);
      const scouted = await scoutAgent.run(
        { languages: wantedLanguages, limit, signal, token: input.token },
        ctx
      );

      // 3 — Rank
      const ranked = await rankerAgent.run(
        {
          issues: scouted.issues,
          profile: {
            skills: profileResult.skills,
            languages: profileResult.languages,
            level: profileResult.level,
          },
        },
        ctx
      );

      return {
        profile: profileResult.profile,
        profileResult,
        issues: ranked.issues,
        rankedSource: ranked.source,
        rankedError: ranked.error || null,
        ratedCount: ranked.ratedCount,
      };
    },

    /**
     * Coach a single issue and run the quality guard over the result.
     */
    async coach(issue, profile, ctx = {}) {
      const plan = await coachAgent.run({ issue, profile }, ctx);
      const guard = await qualityGuardAgent.run(
        { comment: plan.comment, plan: plan.plan, issue },
        ctx
      );
      return { ...plan, guard };
    },

    /**
     * One sentence about the contributor's activity.
     */
    async activityTakeaway(contributions, ctx = {}) {
      return activityAgent.run(
        { totals: contributions?.totals || {}, source: contributions?.source },
        ctx
      );
    },
  };
}

/** Sample contributions for offline mode. */
export function mockContributions(days = 371) {
  return sampleContributions(buildSampleContributions(days));
}

/** A GitHub client bound to the current settings. */
export function clientFromSettings(settings) {
  return createGitHubClient({ token: settings.useToken ? settings.token : null });
}
