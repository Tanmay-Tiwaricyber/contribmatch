/**
 * Provider behaviour: JSON extraction, schema validation, and the single
 * retry that every provider is allowed.
 *
 * The network is mocked, so these tests never touch a real model.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractJson,
  BaseProvider,
  ProviderError,
  OllamaProvider,
  GoogleStudioProvider,
  OpenRouterProvider,
  GroqProvider,
  createProvider,
} from '../js/core/provider.js';
import { validate } from '../js/core/schema.js';

const SCHEMA = {
  type: 'object',
  required: ['summary'],
  properties: { summary: { type: 'string' } },
};

test('plain JSON is extracted', () => {
  assert.deepEqual(extractJson('{"summary":"ok"}'), { summary: 'ok' });
});

test('a fenced JSON block is extracted', () => {
  assert.deepEqual(extractJson('```json\n{"summary":"ok"}\n```'), { summary: 'ok' });
  assert.deepEqual(extractJson('```\n{"summary":"ok"}\n```'), { summary: 'ok' });
});

test('JSON after leading prose is extracted', () => {
  const text = 'Sure! Here is the result:\n{"summary":"ok"}\nHope that helps.';
  assert.deepEqual(extractJson(text), { summary: 'ok' });
});

test('a string that contains braces is not confused', () => {
  const text = '{"summary":"a } brace","other":1}';
  assert.deepEqual(extractJson(text), { summary: 'a } brace', other: 1 });
});

test('text without JSON returns null', () => {
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson(''), null);
  assert.equal(extractJson(null), null);
  assert.equal(extractJson('{"unbalanced": '), null);
});

/** A provider whose replies are scripted. */
class ScriptedProvider extends BaseProvider {
  constructor(replies, { label = 'scripted' } = {}) {
    super({});
    this.replies = replies;
    this.calls = 0;
    this.label = label;
  }

  async _call() {
    const reply = this.replies[Math.min(this.calls, this.replies.length - 1)];
    this.calls += 1;
    return reply;
  }
}

test('a valid reply is returned without a retry', async () => {
  const provider = new ScriptedProvider(['{"summary":"hello"}']);
  const result = await provider.generate({ system: 's', prompt: 'p', schema: SCHEMA });
  assert.deepEqual(result, { summary: 'hello' });
  assert.equal(provider.calls, 1);
});

test('invalid JSON is retried exactly once', async () => {
  const provider = new ScriptedProvider(['not json at all', '{"summary":"second try"}']);
  const result = await provider.generate({ system: 's', prompt: 'p', schema: SCHEMA });
  assert.deepEqual(result, { summary: 'second try' });
  assert.equal(provider.calls, 2);
});

test('output that fails validation is retried exactly once', async () => {
  const provider = new ScriptedProvider(['{"wrong":1}', '{"summary":"ok"}']);
  const result = await provider.generate({ system: 's', prompt: 'p', schema: SCHEMA });
  assert.deepEqual(result, { summary: 'ok' });
  assert.equal(provider.calls, 2);
});

test('two failures raise a provider error and stop', async () => {
  const provider = new ScriptedProvider(['still not json']);
  await assert.rejects(
    () => provider.generate({ system: 's', prompt: 'p', schema: SCHEMA }),
    (err) => {
      assert.ok(err instanceof ProviderError);
      assert.equal(err.kind, 'parse');
      return true;
    }
  );
  assert.equal(provider.calls, 2, 'never more than two attempts');
});

test('a network failure is not retried', async () => {
  class BrokenProvider extends BaseProvider {
    constructor() {
      super({});
      this.calls = 0;
    }
    async _call() {
      this.calls += 1;
      throw new ProviderError('connection refused', { kind: 'network' });
    }
  }
  const provider = new BrokenProvider();
  await assert.rejects(() => provider.generate({ system: 's', prompt: 'p', schema: SCHEMA }));
  assert.equal(provider.calls, 1, 'a network error is not worth a second attempt');
});

test('the Ollama provider posts to the chat endpoint and reads the reply', async () => {
  const calls = [];
  const provider = new OllamaProvider({
    endpoint: 'http://localhost:11434',
    model: 'gemma3:4b',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { message: { content: '{"summary":"from ollama"}' } };
        },
      };
    },
  });
  const result = await provider.generate({ system: 's', prompt: 'p', schema: SCHEMA });
  assert.deepEqual(result, { summary: 'from ollama' });
  assert.equal(calls[0].url, 'http://localhost:11434/api/chat');
  assert.equal(calls[0].options.method, 'POST');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, 'gemma3:4b');
  assert.equal(body.format, 'json');
  assert.equal(body.messages[0].role, 'system');
});

test('a missing Ollama model is a configuration error, not a retry', async () => {
  const provider = new OllamaProvider({
    fetchImpl: async () => ({ ok: false, status: 404, async json() { return {}; } }),
  });
  await assert.rejects(
    () => provider.generate({ system: 's', prompt: 'p', schema: SCHEMA }),
    (err) => {
      assert.equal(err.kind, 'config');
      return true;
    }
  );
});

test('the Google AI Studio provider requires a key and never sends one in the body', async () => {
  assert.throws(() => new GoogleStudioProvider({}), /API key is required/);

  const calls = [];
  const provider = new GoogleStudioProvider({
    apiKey: 'test-key-not-real',
    model: 'gemma-3-27b-it',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { candidates: [{ content: { parts: [{ text: '{"summary":"from studio"}' }] } }] };
        },
      };
    },
  });
  const result = await provider.generate({ system: 's', prompt: 'p', schema: SCHEMA });
  assert.deepEqual(result, { summary: 'from studio' });
  assert.ok(calls[0].url.includes('key=test-key-not-real'));
  assert.ok(!calls[0].options.body.includes('test-key-not-real'));
});

test('createProvider builds the right implementation', () => {
  assert.ok(createProvider({ provider: 'ollama' }) instanceof OllamaProvider);
  assert.ok(createProvider({ provider: 'google', apiKey: 'k' }) instanceof GoogleStudioProvider);
  assert.ok(createProvider({ provider: 'openrouter', apiKey: 'k' }) instanceof OpenRouterProvider);
  assert.ok(createProvider({ provider: 'groq', apiKey: 'k' }) instanceof GroqProvider);
  assert.throws(() => createProvider({ provider: 'mock' }), /createMockProvider/);
  assert.throws(() => createProvider({ provider: 'nope' }), /Unknown provider/);
});

/* ------------------------------------------------------------------ *
 * The OpenAI-compatible hosted providers: OpenRouter and Groq.
 *
 * Same wire format for both:
 *   POST {endpoint}, Authorization: Bearer <key>,
 *   { model, messages, temperature } -> choices[0].message.content
 * ------------------------------------------------------------------ */

test('the OpenRouter provider posts to its endpoint with the key in the header', async () => {
  const calls = [];
  const provider = new OpenRouterProvider({
    apiKey: 'openrouter-key-not-real',
    model: 'google/gemma-3-27b-it:free',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { choices: [{ message: { content: '{"summary":"from openrouter"}' } }] };
        },
      };
    },
  });
  const result = await provider.generate({ system: 's', prompt: 'p', schema: SCHEMA });
  assert.deepEqual(result, { summary: 'from openrouter' });
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer openrouter-key-not-real');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, 'google/gemma-3-27b-it:free');
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[1].role, 'user');
  // The key travels in the header, never in the body.
  assert.ok(!calls[0].options.body.includes('openrouter-key-not-real'));
  // Attribution headers OpenRouter documents for apps.
  assert.equal(calls[0].options.headers['X-Title'], 'ContribMatch');
});

test('the Groq provider defaults to a current open model, not a retired Gemma', async () => {
  assert.equal(new GroqProvider({ apiKey: 'k' }).model, 'openai/gpt-oss-120b');
  assert.equal(new OpenRouterProvider({ apiKey: 'k' }).model, 'google/gemma-3-27b-it');

  const calls = [];
  const provider = new GroqProvider({
    apiKey: 'groq-key-not-real',
    model: 'openai/gpt-oss-120b',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { choices: [{ message: { content: '{"summary":"from groq"}' } }] };
        },
      };
    },
  });
  const result = await provider.generate({ system: 's', prompt: 'p', schema: SCHEMA });
  assert.deepEqual(result, { summary: 'from groq' });
  assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer groq-key-not-real');
  assert.equal(JSON.parse(calls[0].options.body).model, 'openai/gpt-oss-120b');
});

test('a wrong key on a hosted provider is a configuration error, not a retry', async () => {
  for (const Ctor of [OpenRouterProvider, GroqProvider]) {
    const provider = new Ctor({
      apiKey: 'bad-key',
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        async text() { return 'invalid api key'; },
      }),
    });
    await assert.rejects(
      () => provider.generate({ system: 's', prompt: 'p', schema: SCHEMA }),
      (err) => {
        assert.ok(err instanceof ProviderError);
        assert.equal(err.kind, 'config');
        assert.match(err.message, /401/);
        return true;
      }
    );
  }
});

test('both hosted providers require a key at construction', () => {
  assert.throws(() => new OpenRouterProvider({}), /An OpenRouter API key is required/);
  assert.throws(() => new GroqProvider({}), /A Groq API key is required/);
});

test('an empty completion from a hosted provider is a parse error', async () => {
  const provider = new GroqProvider({
    apiKey: 'k',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() { return { choices: [] }; },
    }),
  });
  await assert.rejects(
    () => provider.generate({ system: 's', prompt: 'p', schema: SCHEMA }),
    (err) => {
      assert.equal(err.kind, 'parse');
      return true;
    }
  );
});

test('the validator used by providers catches a missing field', () => {
  const errors = validate({ other: 1 }, SCHEMA);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /summary/);
});
