/**
 * Provider interface.
 *
 * One method, one contract:
 *
 *   provider.generate({ system, prompt, schema }) -> Promise<object>
 *
 * Two real implementations are provided — Ollama (local, open weights) and
 * Google AI Studio (hosted Gemma). A mock implementation powers offline demo
 * mode. Every implementation must:
 *
 *   - return strict JSON parsed from the model output,
 *   - validate it against `schema` before returning,
 *   - retry exactly once when the output cannot be parsed or validated.
 *
 * The caller supplies a `fallback` so a failed model never breaks the flow.
 * DOM-free: all network access goes through the injected `fetch`.
 */

/** Errors a provider can raise. */
export class ProviderError extends Error {
  constructor(message, { kind = 'unknown', cause = null } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind; // 'network' | 'parse' | 'validation' | 'timeout' | 'config'
    this.cause = cause;
  }
}

/**
 * Extract a JSON object from model output.
 * Handles ```json fences and leading prose.
 * @param {string} text
 * @returns {object|null}
 */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  let s = text.trim();

  // Strip markdown fences.
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();

  // Try direct parse.
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* fall through */
  }

  // Try the first balanced object in the text.
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(s.slice(start, i + 1));
          if (parsed && typeof parsed === 'object') return parsed;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Convert a model's word-scale answers into the integers the schema wants.
 *
 * Small local models answer "Easy"/"Medium"/"High" even when the prompt says
 * "integer 1-5"; a 3 also arrives as "3". Coercing these before validation
 * keeps a working local model from being treated as unavailable.
 * @param {unknown} value response value to convert
 * @returns {unknown} number when convertible, else the original value
 */
export function toSchemaInt(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : Math.round(value);
  }
  if (typeof value !== 'string') return value;
  const words = {
    '1': 1, easy: 1, trivial: 1, veryeasy: 1, 'very easy': 1, lowest: 1, minimal: 1, terrible: 1,
    '2': 2, simple: 2, light: 2, basic: 2, low: 2, poor: 2,
    '3': 3, medium: 3, moderate: 3, average: 3, okay: 3, ok: 3, fair: 3, mid: 3,
    '4': 4, hard: 4, high: 4, complex: 4, difficult: 4, good: 4, strong: 4,
    '5': 5, hardest: 5, 'very hard': 5, extreme: 5, 'extremely hard': 5, veryhigh: 5, 'very high': 5, excellent: 5, perfect: 5,
  };
  const key = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (Number.isFinite(Number(key))) {
    const n = Number(key);
    if (Number.isInteger(n)) return n;
    return Math.round(n);
  }
  if (Object.prototype.hasOwnProperty.call(words, key)) return words[key];
  // Fold "very easy"/"very high" spellings without spaces after removal.
  const compact = key.replace(/\s+/g, '');
  if (Object.prototype.hasOwnProperty.call(words, compact)) return words[compact];
  return value;
}

/**
 * Recursively coerce values in `data` wherever `schema` says type integer.
 * Returns the data unchanged when schema is absent or not an object.
 * @param {object} data parsed model JSON
 * @param {object} schema the JSON-schema-ish response schema
 * @returns {object}
 */
export function coerceToSchema(data, schema) {
  if (!schema || typeof schema !== 'object') return data;
  function walk(value, sch) {
    if (sch == null || typeof sch !== 'object') return value;
    if (sch.type === 'integer') return toSchemaInt(value);
    if (Array.isArray(value) && sch.items) return value.map((item) => walk(item, sch.items));
    if (value && typeof value === 'object' && sch.properties) {
      const out = { ...value };
      for (const [key, child] of Object.entries(sch.properties)) {
        if (key in out) out[key] = walk(out[key], child);
      }
      return out;
    }
    return value;
  }
  return walk(data, schema);
}

/**
 * Base class handling the retry + validate loop. Subclasses implement
 * `_call({system, prompt})` and return raw text.
 */
export class BaseProvider {
  constructor({ fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 60000, logger = null } = {}) {
    // `.bind` is essential: a bare `globalThis.fetch` is unusable in browsers
    // ("Failed to execute 'fetch' on 'Window': Illegal invocation"), which read
    // as "the AI model is unavailable". Node's fetch is forgiving, so tests
    // never spotted it. core/provider.js test: provider-timeout.test.js.
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
    this.label = 'provider';
  }

  /**
   * @param {{system: string, prompt: string, schema: object}} req
   * @returns {Promise<object>} validated JSON
   */
  async generate({ system, prompt, schema }) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this._call({ system, prompt, attempt });
        const parsed = extractJson(raw);
        if (!parsed) {
          lastError = new ProviderError('Model did not return valid JSON', { kind: 'parse' });
        } else {
          const { validate } = await import('./schema.js');
          const coerced = coerceToSchema(parsed, schema);
          const errors = validate(coerced, schema);
          if (!errors.length) return coerced;
          lastError = new ProviderError(
            `Model output failed validation: ${errors.join('; ')}`,
            { kind: 'validation' }
          );
        }
      } catch (err) {
        lastError = err instanceof ProviderError ? err : new ProviderError(err.message, {
          kind: 'network',
          cause: err,
        });
        // A network or configuration failure will not be fixed by a retry of
        // the same call, so surface it immediately.
        if (lastError.kind === 'network' || lastError.kind === 'config') throw lastError;
      }
      this.logger?.(`[${this.label}] attempt ${attempt + 1} failed: ${lastError?.message}`);
    }
    throw lastError || new ProviderError('Model call failed', { kind: 'unknown' });
  }

  /* eslint-disable-next-line no-unused-vars */
  async _call({ system, prompt }) {
    throw new Error('not implemented');
  }
}

/**
 * Ollama — local open-weight models (Gemma 3, Qwen, Llama…).
 * The browser must be allowed to reach the daemon; see docs for CORS.
 */
export class OllamaProvider extends BaseProvider {
  constructor({
    endpoint = 'http://localhost:11434',
    model = 'gemma3:4b',
    temperature = 0.2,
    keepAlive = '30m',
    timeoutMs = 300000,
    ...rest
  } = {}) {
    super({ ...rest, timeoutMs });
    this.endpoint = endpoint.replace(/\/$/, '');
    this.model = model;
    this.temperature = temperature;
    this.keepAlive = keepAlive;
    this.label = `ollama:${model}`;
  }

  async _call({ system, prompt }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: 'json',
          keep_alive: this.keepAlive,
          options: { temperature: this.temperature },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = err?.name === 'AbortError';
      throw new ProviderError(
        timedOut
          ? `Ollama at ${this.endpoint} did not answer within ${Math.round(this.timeoutMs / 1000)}s (loading a local model on CPU can take a few minutes the first time).`
          : `Cannot reach Ollama at ${this.endpoint}. ${err.message}`,
        { kind: 'network', cause: err }
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const kind = res.status === 404 ? 'config' : 'network';
      throw new ProviderError(
        `Ollama responded ${res.status}. Check that the model "${this.model}" is pulled.`,
        { kind }
      );
    }
    const data = await res.json();
    return data?.message?.content ?? data?.response ?? '';
  }
}

/**
 * Google AI Studio — hosted Gemma.
 * The API key is supplied by the user at runtime and must never be committed.
 */
export class GoogleStudioProvider extends BaseProvider {
  constructor({
    apiKey,
    model = 'gemma-3-27b-it',
    endpoint = 'https://generativelanguage.googleapis.com/v1beta',
    temperature = 0.2,
    ...rest
  } = {}) {
    super(rest);
    if (!apiKey) {
      throw new ProviderError('A Google AI Studio API key is required.', { kind: 'config' });
    }
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint.replace(/\/$/, '');
    this.temperature = temperature;
    this.label = `google:${model}`;
  }

  async _call({ system, prompt }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetch(
        `${this.endpoint}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: this.temperature,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        }
      );
    } catch (err) {
      throw new ProviderError(`Cannot reach Google AI Studio. ${err.message}`, {
        kind: 'network',
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const kind = res.status === 400 || res.status === 401 || res.status === 403 ? 'config' : 'network';
      throw new ProviderError(
        `Google AI Studio responded ${res.status}. ${body.slice(0, 200)}`,
        { kind }
      );
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!parts?.length) {
      const reason = data?.promptFeedback?.blockReason || 'no content returned';
      throw new ProviderError(`Empty response from Google AI Studio (${reason}).`, {
        kind: 'parse',
      });
    }
    return parts.map((p) => p.text || '').join('');
  }
}

/**
 * Build a provider from plain settings.
 * @param {{provider:'ollama'|'google'|'mock', model?:string, apiKey?:string, endpoint?:string}} settings
 */
export function createProvider(settings = {}, deps = {}) {
  const kind = settings.provider || 'mock';
  if (kind === 'ollama') {
    return new OllamaProvider({
      endpoint: settings.endpoint || 'http://localhost:11434',
      model: settings.model || 'gemma3:4b',
      ...deps,
    });
  }
  if (kind === 'google') {
    return new GoogleStudioProvider({
      apiKey: settings.apiKey,
      model: settings.model || 'gemma-3-27b-it',
      ...deps,
    });
  }
  if (kind === 'mock') {
    throw new ProviderError('Use createMockProvider() for offline mode.', { kind: 'config' });
  }
  throw new ProviderError(`Unknown provider "${kind}".`, { kind: 'config' });
}
