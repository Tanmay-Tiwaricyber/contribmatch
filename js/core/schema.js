/**
 * A very small, dependency-free JSON-schema subset used to validate what a
 * language model returns before the app trusts it.
 *
 * Supported: type (string|number|integer|boolean|object|array|null),
 * required, properties, additionalProperties, items, enum, minimum, maximum,
 * minLength, maxLength, minItems, maxItems, pattern, default, nullable.
 *
 * DOM-free: safe to import from Node tests.
 */

/**
 * @typedef {Object} Schema
 * @property {string} [type]
 * @property {string[]} [required]
 * @property {Object} [properties]
 * @property {boolean} [additionalProperties]
 * @property {Object} [items]
 * @property {Array<string|number>} [enum]
 * @property {number} [minimum]
 * @property {number} [maximum]
 * @property {number} [minLength]
 * @property {number} [maxLength]
 * @property {number} [minItems]
 * @property {number} [maxItems]
 * @property {RegExp|string} [pattern]
 */

/**
 * @param {any} value
 * @param {Schema} schema
 * @param {string} [path]
 * @returns {string[]} list of human readable errors
 */
export function validate(value, schema, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  const type = schema.type;
  if (type) {
    const types = Array.isArray(type) ? type : [type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path}: expected ${types.join('|')}, got ${describe(value)}`);
      return errors; // deeper checks are meaningless once the type is wrong
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in [${schema.enum.join(', ')}]`);
  }

  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push(`${path}: shorter than ${schema.minLength}`);
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push(`${path}: longer than ${schema.maxLength}`);
    }
    if (schema.pattern) {
      const re = schema.pattern instanceof RegExp ? schema.pattern : new RegExp(schema.pattern);
      if (!re.test(value)) errors.push(`${path}: does not match ${re}`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push(`${path}: above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push(`${path}: needs at least ${schema.minItems} items`);
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push(`${path}: allows at most ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, i) => errors.push(...validate(item, schema.items, `${path}[${i}]`)));
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!(key in value) || value[key] === undefined) {
        errors.push(`${path}: missing required property "${key}"`);
      }
    }
    const props = schema.properties || {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value && value[key] !== undefined) {
        errors.push(...validate(value[key], sub, `${path}.${key}`));
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}: unexpected property "${key}"`);
      }
    }
  }

  return errors;
}

/** Validate and return the value, throwing on failure. */
export function assertValid(value, schema, label = 'model output') {
  const errors = validate(value, schema);
  if (errors.length) {
    const err = new Error(`Invalid ${label}: ${errors.join('; ')}`);
    err.errors = errors;
    throw err;
  }
  return value;
}

/** Fill in missing optional properties with their schema defaults. */
export function withDefaults(value, schema) {
  if (!schema || !value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = { ...value };
  for (const [key, sub] of Object.entries(schema.properties || {})) {
    if (out[key] === undefined && sub && 'default' in sub) {
      out[key] = sub.default;
    } else if (out[key] !== undefined && sub && sub.properties) {
      out[key] = withDefaults(out[key], sub);
    }
  }
  return out;
}

function matchesType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
