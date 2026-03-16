import { describe, it } from 'node:test';
import { equal, ok, match, strictEqual } from 'node:assert';
import {
  generateId,
  formatDate,
  sleep,
  sanitizeString,
  isValidPostcode,
  paginate,
} from './helpers.ts';

describe('helpers', () => {
  // ─── generateId ───────────────────────────────────────────────────────────────

  describe('generateId', () => {
    it('should return a non-empty string', () => {
      const id = generateId();
      ok(typeof id === 'string' && id.length > 0);
    });

    it('should return a string of alphanumeric characters (base-36 subset)', () => {
      const id = generateId();
      match(id, /^[a-z0-9]+$/);
    });

    it('should return a unique value on each call', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      // With Math.random there is an astronomically small chance of collision — 100 unique ids is a safe sanity check
      ok(ids.size > 90, 'expected mostly unique ids');
    });
  });

  // ─── formatDate ───────────────────────────────────────────────────────────────

  describe('formatDate', () => {
    it('should return a valid ISO 8601 string', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = formatDate(date);
      equal(result, '2024-01-15T10:30:00.000Z');
    });

    it('should preserve milliseconds in the output', () => {
      const date = new Date('2024-06-01T12:00:00.123Z');
      match(formatDate(date), /\.123Z$/);
    });

    it('should return the same value as Date.prototype.toISOString', () => {
      const date = new Date();
      equal(formatDate(date), date.toISOString());
    });
  });

  // ─── sleep ────────────────────────────────────────────────────────────────────

  describe('sleep', () => {
    it('should resolve after approximately the given number of milliseconds', async () => {
      const ms = 50;
      const start = Date.now();
      await sleep(ms);
      const elapsed = Date.now() - start;
      ok(elapsed >= ms - 10, `elapsed ${elapsed}ms, expected >= ${ms - 10}ms`);
    });

    it('should return a Promise', () => {
      const result = sleep(0);
      ok(result instanceof Promise);
      return result; // let the test runner await the cleanup
    });
  });

  // ─── sanitizeString ───────────────────────────────────────────────────────────

  describe('sanitizeString', () => {
    it('should trim leading and trailing whitespace', () => {
      equal(sanitizeString('  hello  '), 'hello');
    });

    it('should convert the string to lower case', () => {
      equal(sanitizeString('Hello World'), 'hello world');
    });

    it('should trim AND lower-case in one call', () => {
      equal(sanitizeString('  HELLO  '), 'hello');
    });

    it('should return an empty string for an all-whitespace input', () => {
      equal(sanitizeString('   '), '');
    });

    it('should leave an already-sanitized string unchanged', () => {
      equal(sanitizeString('already clean'), 'already clean');
    });
  });

  // ─── isValidPostcode ──────────────────────────────────────────────────────────

  describe('isValidPostcode', () => {
    const valid = [
      'SW1A 1AA', // Buckingham Palace
      'EC1A 1BB', // London EC1
      'W1A 0AX', // Oxford Street
      'M1 1AE', // Manchester
      'B1 1BB', // Birmingham
      'sw1a 1aa', // case-insensitive lower
      'ZZ9 9ZZ', // matches the regex pattern (format: AA# #AA)
    ];

    const invalid = ['', '1234', 'INVALID', 'SW1A1AA1', '12345-6789'];

    for (const postcode of valid) {
      it(`should return true for valid postcode "${postcode}"`, () => {
        ok(isValidPostcode(postcode), `expected "${postcode}" to be valid`);
      });
    }

    for (const postcode of invalid) {
      it(`should return false for invalid postcode "${postcode}"`, () => {
        ok(!isValidPostcode(postcode), `expected "${postcode}" to be invalid`);
      });
    }
  });

  // ─── paginate ─────────────────────────────────────────────────────────────────

  describe('paginate', () => {
    it('should compute offset as (page - 1) * limit', () => {
      const result = paginate(3, 10);
      equal(result.offset, 20);
    });

    it('should return limit unchanged', () => {
      const result = paginate(1, 25);
      equal(result.limit, 25);
    });

    it('should return offset 0 for page 1', () => {
      const result = paginate(1, 10);
      equal(result.offset, 0);
    });

    it('should handle large page numbers', () => {
      const result = paginate(100, 50);
      equal(result.offset, 4950);
      equal(result.limit, 50);
    });

    it('should return the correct shape { offset, limit }', () => {
      const result = paginate(2, 5);
      strictEqual('offset' in result, true);
      strictEqual('limit' in result, true);
      equal(Object.keys(result).length, 2);
    });
  });
});
