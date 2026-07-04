import assert from 'node:assert';
import { describe, test } from 'node:test';

describe('review.routes', () => {
  test('should export router module without errors', async () => {
    const mod = await import('./review.routes.ts');
    assert.ok(mod.default, 'Router should be the default export');
  });
});
