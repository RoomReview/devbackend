import assert from 'node:assert';
import { describe, test } from 'node:test';

describe('blog-category.routes', () => {
  test('should export router module without errors', async () => {
    const mod = await import('./blog-category.routes.ts');
    assert.ok(mod.default, 'Router should be the default export');
  });
});
