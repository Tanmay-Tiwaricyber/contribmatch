/**
 * Community packs.
 *
 * A pack is a plain JSON or YAML file that describes skills, language and
 * tone. The matcher uses it to explain an issue in the right words.
 *
 * The same validator runs in the browser and in `npm run validate:packs`.
 */

import { validate } from './schema.js';
import { parseYaml } from './yaml.js';

export const PACK_TYPES = ['skill', 'ecosystem', 'tone'];
export const PACK_LANGUAGES = ['en', 'hi', 'hinglish'];
export const PACK_LEVELS = ['beginner', 'intermediate', 'advanced'];

export const PACK_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'type', 'description', 'languages', 'skills', 'tone', 'version'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 2, maxLength: 64, pattern: /^[a-z0-9-]+$/ },
    name: { type: 'string', minLength: 2, maxLength: 80 },
    type: { type: 'string', enum: PACK_TYPES },
    description: { type: 'string', minLength: 10, maxLength: 400 },
    version: { type: 'string', pattern: /^\d+\.\d+\.\d+$/ },
    languages: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: { type: 'string', enum: PACK_LANGUAGES },
    },
    skills: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: { type: 'string', minLength: 1, maxLength: 40 },
    },
    tone: { type: 'string', minLength: 2, maxLength: 40 },
    level: { type: 'string', enum: PACK_LEVELS },
    ecosystems: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 40 } },
    vocabulary: { type: 'object' },
    guidance: { type: 'object' },
    homepage: { type: 'string', maxLength: 200 },
    license: { type: 'string', maxLength: 40 },
    author: { type: 'string', maxLength: 80 },
  },
};

/**
 * Validate a pack object.
 * @param {object} pack
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePack(pack) {
  const errors = validate(pack, PACK_SCHEMA);
  const out = [...errors];

  if (pack && typeof pack === 'object') {
    if (pack.id && !/^[a-z0-9-]+$/.test(String(pack.id))) {
      out.push('$.id: use lowercase letters, numbers and hyphens only');
    }
    if (Array.isArray(pack.skills)) {
      const seen = new Set();
      for (const skill of pack.skills) {
        const key = String(skill).toLowerCase();
        if (seen.has(key)) out.push(`$.skills: duplicate skill "${skill}"`);
        seen.add(key);
      }
    }
  }

  return { valid: out.length === 0, errors: out };
}

/**
 * Parse a pack file by extension.
 * @param {string} source
 * @param {'json'|'yaml'} format
 */
export function parsePack(source, format) {
  if (format === 'yaml' || format === 'yml') {
    return parseYaml(source);
  }
  return JSON.parse(source);
}

/**
 * The manifest of packs shipped with the app.
 * Kept explicit so the packs page and the validator agree.
 */
export const PACK_FILES = [
  { file: 'packs/web-basics.pack.json', format: 'json' },
  { file: 'packs/python-data.pack.json', format: 'json' },
  { file: 'packs/docs-translation.pack.json', format: 'json' },
  { file: 'packs/go-ecosystem.pack.json', format: 'json' },
  { file: 'packs/tone-plain-technical.pack.yaml', format: 'yaml' },
];

/**
 * Load every pack listed in the manifest.
 * @param {{fetchImpl?: typeof fetch, base?: string}} [opts]
 */
export async function loadPacks({ fetchImpl, base = '' } = {}) {
  const doFetch = fetchImpl || globalThis.fetch.bind(globalThis);
  const packs = [];
  const errors = [];

  for (const entry of PACK_FILES) {
    try {
      const res = await doFetch(`${base}${entry.file}`);
      if (!res.ok) {
        errors.push(`${entry.file}: HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      const pack = parsePack(text, entry.format);
      const result = validatePack(pack);
      if (!result.valid) {
        errors.push(`${entry.file}: ${result.errors.join('; ')}`);
        continue;
      }
      packs.push({ ...pack, __file: entry.file, __format: entry.format });
    } catch (err) {
      errors.push(`${entry.file}: ${err.message}`);
    }
  }

  return { packs, errors };
}
