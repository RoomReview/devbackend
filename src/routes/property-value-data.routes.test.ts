import assert from 'node:assert';
import { describe, test } from 'node:test';

describe('property-value-data.routes', () => {
  test('should export router module without errors', async () => {
    const mod = await import('./property-value-data.routes.ts');
    assert.ok(mod.default, 'Router should be the default export');
  });
});
