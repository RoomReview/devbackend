import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupUnverifiedAccounts } from './unverified-account-cleanup.service';

describe('cleanupUnverifiedAccounts', () => {
  it('uses the exact three-day-old cutoff and returns the deleted account count', async () => {
    const now = new Date('2026-11-07T12:00:00.000Z');
    let receivedCutoff: Date | undefined;

    const deletedCount = await cleanupUnverifiedAccounts(now, async (cutoff) => {
      receivedCutoff = cutoff;
      return { count: 2 };
    });

    assert.equal(receivedCutoff?.toISOString(), '2026-11-04T12:00:00.000Z');
    assert.equal(deletedCount, 2);
  });
});
