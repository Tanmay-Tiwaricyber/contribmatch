/**
 * A small YAML reader.
 *
 * Supports the subset the pack format needs: scalars, flow lists, block lists,
 * nested maps, and folded (`>`) or literal (`|`) block scalars. It does not
 * support anchors, aliases, tags, multiple documents or complex keys.
 *
 * Keeping this in the repo means the app needs no build step and no parser
 * dependency — which is the point of the project.
 */

/**
 * @param {string} source
 * @returns {object}
 */
export function parseYaml(source) {
  const lines = String(source ?? '')
    .split('\n')
    .map((line) => line.replace(/\t/g, '  ').replace(/\s+$/, ''));

  const entries = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    entries.push({ indent: line.length - line.trimStart().length, text: trimmed, raw: line });
  }

  if (!entries.length) return {};
  const [value] = parseBlock(entries, 0, entries[0].indent);
  return value;
}

/**
 * Parse a block of lines at the given indentation.
 * @returns {[any, number]} the value and the index after the block
 */
function parseBlock(entries, start, indent) {
  if (start >= entries.length) return [null, start];

  if (entries[start].text.startsWith('- ') || entries[start].text === '-') {
    return parseList(entries, start, indent);
  }
  return parseMap(entries, start, indent);
}

function parseList(entries, start, indent) {
  const out = [];
  let i = start;
  while (i < entries.length) {
    const entry = entries[i];
    if (entry.indent < indent) break;
    if (entry.indent > indent) {
      // A more indented line after a list item is part of that item.
      const [value, next] = parseBlock(entries, i, entry.indent);
      if (out.length) out[out.length - 1] = value;
      i = next;
      continue;
    }
    if (!(entry.text.startsWith('- ') || entry.text === '-')) break;
    const inline = entry.text === '-' ? '' : entry.text.slice(2).trim();
    if (inline === '') {
      // Value continues on the following, more indented lines.
      const nextEntry = entries[i + 1];
      if (nextEntry && nextEntry.indent > indent) {
        const [value, next] = parseBlock(entries, i + 1, nextEntry.indent);
        out.push(value);
        i = next;
      } else {
        out.push(null);
        i += 1;
      }
      continue;
    }
    out.push(parseScalar(inline));
    i += 1;
  }
  return [out, i];
}

function parseMap(entries, start, indent) {
  const out = {};
  let i = start;
  while (i < entries.length) {
    const entry = entries[i];
    if (entry.indent < indent) break;
    if (entry.indent > indent) {
      i += 1;
      continue;
    }
    if (entry.text.startsWith('- ')) break;

    const colon = findKeyColon(entry.text);
    if (colon === -1) {
      i += 1;
      continue;
    }
    const key = unquote(entry.text.slice(0, colon).trim());
    const rest = entry.text.slice(colon + 1).trim();
    i += 1;

    if (rest === '>' || rest === '>-' || rest === '|' || rest === '|-') {
      // Block scalar: gather the more indented lines that follow.
      const parts = [];
      while (i < entries.length && entries[i].indent > indent) {
        parts.push(entries[i].text);
        i += 1;
      }
      const joined = rest.startsWith('|') ? parts.join('\n') : parts.join(' ');
      out[key] = joined.trim();
      continue;
    }

    if (rest === '') {
      const nextEntry = entries[i];
      if (nextEntry && nextEntry.indent > indent) {
        const [value, next] = parseBlock(entries, i, nextEntry.indent);
        out[key] = value;
        i = next;
      } else if (nextEntry && nextEntry.indent === indent && nextEntry.text.startsWith('- ')) {
        const [value, next] = parseList(entries, i, indent);
        out[key] = value;
        i = next;
      } else {
        out[key] = '';
      }
      continue;
    }

    if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim();
      out[key] = inner
        ? inner.split(',').map((part) => parseScalar(unquote(part.trim())))
        : [];
      continue;
    }

    out[key] = parseScalar(rest);
  }
  return [out, i];
}

/** Find the colon that separates a key from its value, ignoring colons in quotes. */
function findKeyColon(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ':' && (i === text.length - 1 || /\s/.test(text[i + 1]))) return i;
  }
  return -1;
}

function unquote(value) {
  const text = String(value).trim();
  if (
    (text.startsWith('"') && text.endsWith('"') && text.length > 1) ||
    (text.startsWith("'") && text.endsWith("'") && text.length > 1)
  ) {
    return text.slice(1, -1);
  }
  return text;
}

/** Convert a scalar string to a number, boolean, null or string. */
function parseScalar(value) {
  const text = unquote(value);
  if (text === '') return '';
  if (text === 'true' || text === 'True') return true;
  if (text === 'false' || text === 'False') return false;
  if (text === 'null' || text === '~' || text === 'Null') return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d*\.\d+$/.test(text)) return Number(text);
  return text;
}

export default parseYaml;
