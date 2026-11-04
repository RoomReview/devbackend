import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isRewardsAccessUnlocked } from './affiliate-reward.service.ts';

describe('affiliate rewards access', () => {
  it('unlocks after the first approved review', () => {
    assert.equal(isRewardsAccessUnlocked(false, 1, 0), true);
  });

  it('keeps access unlocked after the approved review is later removed', () => {
    assert.equal(isRewardsAccessUnlocked(true, 0, 0), true);
  });

  it('does not unlock before a review is approved', () => {
    assert.equal(isRewardsAccessUnlocked(false, 0, 0), false);
  });
});
