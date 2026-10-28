/**
 * Provider robustness tests — no network, no model required.
 *
 * Covers the two failure modes that made a healthy local Ollama look
 * "unavailable": an abort while a slow local model thinks, and word-scale
 * ("Easy", "High") or string-number answers where the schema wants integers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toSchemaInt,
  coerceToSchema,
  BaseProvider,
  OllamaProvider,
  ProviderError,
} from '../js/core/provider.js';

test('toSchemaInt maps word scales and string numbers to integers', () => {
  assert.equal(toSchemaInt('Easy'), 1);
  assert.equal(toSchemaInt('Medium'), 3);
  assert.equal(toSchemaInt('Hard'), 4);
  assert.equal(toSchemaInt(' High '), 4);
  assert.equal(toSchemaInt('very easy'), 1);
  assert.equal(toSchemaInt('Very High'), 5);
  assert.equal(toSchemaInt('4'), 4);
  assert.equal(toSchemaInt('3.5'), 4);
  assert.equal(toSchemaInt(2), 2);
  assert.equal(toSchemaInt(3.5), 4);
  // Unconvertible garbage passes through so validation reports it honestly.
  assert.equal(toSchemaInt('banana'), 'banana');
  assert.equal(toSchemaInt(null), null);
});

test('coerceToSchema coerces nested rating objects and arrays', () => {
  const schema = {
    type: 'object',
    properties: {
      ratings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            difficulty: { type: 'integer' },
            clarity: { type: 'integer' },
            fit: { type: 'integer' },
          },
        },
      },
    },
  };
  const out = coerceToSchema(
    {
      ratings: [
        { id: 'a', difficulty: 'Easy', clarity: 'Medium', fit: 'High', note: 'text stays' },
        { id: 'b', difficulty: '4', clarity: 2.7, fit: 'perfect' },
      ],
    },
    schema
  );
  assert.deepEqual(out.ratings[0], { id: 'a', difficulty: 1, clarity: 3, fit: 4, note: 'text stays' });
  assert.deepEqual(
    [out.ratings[1].difficulty, out.ratings[1].clarity, out.ratings[1].fit],
    [4, 3, 5]
  );
});

test('generate() validates and coerces a word-scale model answer', async () => {
  const schema = {
    type: 'object',
    required: ['ratings'],
    properties: {
      ratings: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'difficulty', 'clarity', 'fit'],
          properties: {
            id: { type: 'string' },
            difficulty: { type: 'integer', minimum: 1, maximum: 5 },
            clarity: { type: 'integer', minimum: 1, maximum: 5 },
            fit: { type: 'integer', minimum: 1, maximum: 5 },
          },
        },
      },
    },
  };
  const provider = new (class extends BaseProvider {
    async _call() {
      return '{"ratings":[{"id":"1","difficulty":"Easy","clarity":"High","fit":"Medium"}]}';
    }
  })({ logger: null });

  const out = await provider.generate({ system: 's', prompt: 'p', schema });
  assert.equal(out.ratings[0].difficulty, 1);
  assert.equal(out.ratings[0].clarity, 4);
  assert.equal(out.ratings[0].fit, 3);
});

test('Ollama uses a local-model-sized timeout and keeps the model warm', async () => {
  let captured = null;
  const provider = new OllamaProvider({
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({ message: { content: '{"ratings":[]}' } }),
      };
    },
  });

  assert.equal(provider.timeoutMs, 300000, 'local models need minutes, not 60s');

  const {
    validate, // not used; placeholder for readability
  } = await import('../js/core/schema.js');
  void validate;

  await provider._call({ system: 's', prompt: 'p' });
  assert.equal(captured.url, 'http://localhost:11434/api/chat');
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, 'gemma3:4b');
  assert.equal(body.stream, false);
  assert.equal(body.keep_alive, '30m', 'keeps the loaded model resident for follow-up calls');
});

test('an Ollama abort reports a timeout, not a connection failure', async () => {
  const provider = new OllamaProvider({
    timeoutMs: 15,
    fetchImpl: (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        });
      }),
  });
  await assert.rejects(
    () => provider.generate({ system: 's', prompt: 'p', schema: {} }),
    (err) => {
      assert.ok(err instanceof ProviderError);
      assert.ok(/did not answer within/i.test(err.message), `actual: ${err.message}`);
      return true;
    }
  );
});
