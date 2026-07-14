import assert from 'node:assert';
import { describe, test } from 'node:test';

describe('saved-property.routes', () => {
  test('should export router module without errors', async () => {
    const mod = await import('./saved-property.routes.ts');
    assert.ok(mod.default, 'Router should be the default export');
  });
});
