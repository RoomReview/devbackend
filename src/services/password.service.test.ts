import assert from 'node:assert';
import { describe, test } from 'node:test';
import { comparePassword, hashPassword } from './password.service.ts';

describe('password.service', () => {
  test('hashPassword should return a string in the format "salt:hash"', async () => {
    const password = 'mySecurePassword';
    const hashed = await hashPassword(password);
    assert.strictEqual(typeof hashed, 'string');
    const parts = hashed.split(':');
    assert.strictEqual(parts.length, 2);
    assert.strictEqual(parts[0].length, 32); // 16 bytes salt in hex
    assert.strictEqual(parts[1].length, 128); // 64 bytes hash in hex
  });

  test('comparePassword should return true for correct password', async () => {
    const password = 'mySecurePassword';
    const hashed = await hashPassword(password);
    const isMatch = await comparePassword(password, hashed);
    assert.strictEqual(isMatch, true);
  });
});
