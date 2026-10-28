/**
 * Community packs: schema validation, JSON and YAML parsing.
 *
 * The same validator runs in the browser and in `npm run validate:packs`, so
 * a pack that passes here passes on the site.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  validatePack,
  parsePack,
  PACK_FILES,
  PACK_SCHEMA,
  PACK_TYPES,
} from '../js/core/packs.js';
import { parseYaml } from '../js/core/yaml.js';
import { validate, withDefaults } from '../js/core/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VALID_PACK = {
  id: 'my-pack',
  name: 'My pack',
  type: 'skill',
  description: 'A pack used by the test suite to describe a set of skills.',
  version: '1.0.0',
  languages: ['en'],
  skills: ['testing'],
  tone: 'plain',
};

test('a well formed pack is valid', () => {
  const result = validatePack(VALID_PACK);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('a missing required field is reported', () => {
  const result = validatePack({ ...VALID_PACK, id: undefined });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('id')));
});

test('an unknown type is rejected', () => {
  const result = validatePack({ ...VALID_PACK, type: 'vibes' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('type')));
  assert.deepEqual(PACK_TYPES, ['skill', 'ecosystem', 'tone']);
});

test('an id with capitals is rejected', () => {
  const result = validatePack({ ...VALID_PACK, id: 'MyPack' });
  assert.equal(result.valid, false);
});

test('an id with capitals is caught by the id rule', () => {
  const result = validatePack({ ...VALID_PACK, id: 'My Pack' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('a version must be semantic', () => {
  assert.equal(validatePack({ ...VALID_PACK, version: '1.0' }).valid, false);
  assert.equal(validatePack({ ...VALID_PACK, version: 'v1.0.0' }).valid, false);
  assert.equal(validatePack({ ...VALID_PACK, version: '1.0.0' }).valid, true);
});

test('an unknown field is rejected', () => {
  const result = validatePack({ ...VALID_PACK, surprise: 'value' });
  assert.equal(result.valid, false);
});

test('a duplicate skill is reported', () => {
  const result = validatePack({ ...VALID_PACK, skills: ['testing', 'Testing'] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('duplicate')));
});

test('the language list only accepts supported languages', () => {
  assert.equal(validatePack({ ...VALID_PACK, languages: ['en', 'hi'] }).valid, true);
  assert.equal(validatePack({ ...VALID_PACK, languages: ['en', 'fr'] }).valid, false);
  assert.equal(validatePack({ ...VALID_PACK, languages: [] }).valid, false);
});

test('the schema validator reports the path of a problem', () => {
  const errors = validate({ id: 4 }, { type: 'object', properties: { id: { type: 'string' } } });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\$\.id/);
});

test('the schema validator accepts a valid object', () => {
  const errors = validate(VALID_PACK, PACK_SCHEMA);
  assert.deepEqual(errors, []);
});

test('defaults are applied by the schema helper', () => {
  const filled = withDefaults({ a: 1 }, { type: 'object', properties: { a: { type: 'number' }, b: { type: 'string', default: 'x' } } });
  assert.equal(filled.b, 'x');
});

test('YAML parses into the same shape as JSON', () => {
  const yaml = [
    'id: yaml-pack',
    'name: YAML pack',
    'type: skill',
    'description: A pack that was written in YAML for the test suite.',
    'version: 1.0.0',
    'languages:',
    '  - en',
    '  - hi',
    'skills:',
    '  - testing',
    'tone: plain',
  ].join('\n');
  const pack = parseYaml(yaml);
  assert.equal(pack.id, 'yaml-pack');
  assert.deepEqual(pack.languages, ['en', 'hi']);
  assert.deepEqual(pack.skills, ['testing']);
  assert.equal(validatePack(pack).valid, true);
});

test('the YAML parser handles nested maps and folded scalars', () => {
  const yaml = [
    'id: nested',
    'guidance:',
    '  opening: >',
    '    One sentence that',
    '    continues on the next line.',
    '  list:',
    '    - one',
    '    - two',
  ].join('\n');
  const parsed = parseYaml(yaml);
  assert.match(parsed.guidance.opening, /continues on the next line/);
  assert.deepEqual(parsed.guidance.list, ['one', 'two']);
});

test('parsePack picks the parser by format', () => {
  const json = JSON.stringify(VALID_PACK);
  assert.equal(parsePack(json, 'json').id, 'my-pack');
  assert.equal(parsePack('id: yaml-pack\nname: Y\n', 'yaml').id, 'yaml-pack');
});

test('every pack listed in the manifest exists and is valid', async () => {
  assert.ok(PACK_FILES.length >= 3, 'the repository ships at least three packs');
  for (const entry of PACK_FILES) {
    const text = await readFile(path.join(ROOT, entry.file), 'utf8');
    const pack = parsePack(text, entry.format);
    const result = validatePack(pack);
    assert.equal(result.valid, true, `${entry.file}: ${result.errors.join('; ')}`);
    assert.equal(pack.id, path.basename(entry.file).split('.')[0]);
  }
});

test('the manifest covers the YAML pack', () => {
  assert.ok(
    PACK_FILES.some((entry) => entry.file.endsWith('.pack.yaml')),
    'the tone pack is shipped as YAML'
  );
});
