/**
 * Validate every community pack.
 *
 *   node tools/validate-packs.mjs
 *
 * The same validator runs in the browser, so a pack that passes here is a
 * pack the site can load. Exits with a non-zero status when a pack is broken,
 * which is what a pull request check should do.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePack, parsePack, PACK_FILES } from '../js/core/packs.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

async function main() {
  let failed = 0;
  const seenIds = new Set();

  console.log(`Checking ${PACK_FILES.length} pack(s) in ${path.relative(process.cwd(), ROOT)}/packs\n`);

  for (const entry of PACK_FILES) {
    const file = path.join(ROOT, entry.file);
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch (err) {
      console.log(`${RED}✗${RESET} ${entry.file} — cannot be read (${err.message})`);
      failed += 1;
      continue;
    }

    let pack;
    try {
      pack = parsePack(text, entry.format);
    } catch (err) {
      console.log(`${RED}✗${RESET} ${entry.file} — is not valid ${entry.format.toUpperCase()} (${err.message})`);
      failed += 1;
      continue;
    }

    const result = validatePack(pack);
    if (!result.valid) {
      console.log(`${RED}✗${RESET} ${entry.file}`);
      for (const error of result.errors) console.log(`    ${RED}-${RESET} ${error}`);
      failed += 1;
      continue;
    }

    if (seenIds.has(pack.id)) {
      console.log(`${RED}✗${RESET} ${entry.file} — id "${pack.id}" is used by more than one pack`);
      failed += 1;
      continue;
    }
    seenIds.add(pack.id);

    const expectedId = path.basename(entry.file).split('.')[0];
    if (pack.id !== expectedId) {
      console.log(
        `${RED}✗${RESET} ${entry.file} — id "${pack.id}" does not match the file name "${expectedId}"`
      );
      failed += 1;
      continue;
    }

    console.log(
      `${GREEN}✓${RESET} ${entry.file} ${DIM}(${pack.type}, ${pack.languages.join('/')}, v${pack.version})${RESET}`
    );
  }

  console.log('');
  if (failed) {
    console.log(`${RED}${failed} pack(s) failed validation.${RESET}`);
    process.exitCode = 1;
  } else {
    console.log(`${GREEN}All packs are valid.${RESET}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
