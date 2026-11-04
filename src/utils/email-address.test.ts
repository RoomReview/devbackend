import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeEmailAddress } from './email-address';

describe('normalizeEmailAddress', () => {
  it('trims whitespace and normalizes case', () => {
    assert.strictEqual(normalizeEmailAddress('  User.Name@Example.COM  '), 'user.name@example.com');
  });
});
