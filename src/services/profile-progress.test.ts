import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAchievements, getProfileProgress } from './profile-progress.ts';

describe('profile progress', () => {
  it('counts approved reviews and completed reports toward milestone levels', () => {
    assert.deepEqual(getProfileProgress(3, 2), {
      approvedReviews: 3,
      readyReports: 2,
      contributions: 5,
      level: 2,
      levelName: 'Contributor',
      nextLevel: {
        level: 3,
        name: 'Local Expert',
        contributionsRequired: 15,
        contributionsRemaining: 10,
      },
    });
  });

  it('does not expose a next level after reaching the final milestone', () => {
    assert.equal(getProfileProgress(20, 10).nextLevel, null);
  });

  it('unlocks achievements only at their contribution requirements', () => {
    const achievements = getAchievements(4, 1);
    assert.equal(
      achievements.find(({ id }) => id === 'first-review')?.unlocked,
      true,
    );
    assert.equal(
      achievements.find(({ id }) => id === 'five-reviews')?.unlocked,
      false,
    );
    assert.equal(
      achievements.find(({ id }) => id === 'community-researcher')?.unlocked,
      false,
    );
    assert.equal(
      getAchievements(5, 5).find(({ id }) => id === 'community-researcher')
        ?.unlocked,
      true,
    );
  });
});
