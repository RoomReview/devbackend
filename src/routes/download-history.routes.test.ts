import assert from 'node:assert';
import { describe, test } from 'node:test';

describe('download-history.routes', () => {
  test('should export router module without errors', async () => {
    const mod = await import('./download-history.routes.ts');
    assert.ok(mod.default, 'Router should be the default export');
  });
});
