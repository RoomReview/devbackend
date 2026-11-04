import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isEligibleForAutomaticApproval } from './review-auto-moderation.ts';

describe('review automatic moderation eligibility', () => {
  it('requires more than 50 characters', () => {
    assert.equal(
      isEligibleForAutomaticApproval('A good area', 'a'.repeat(39)),
      false,
    );
    assert.equal(
      isEligibleForAutomaticApproval('A good area', 'a'.repeat(50)),
      false,
    );
    assert.equal(
      isEligibleForAutomaticApproval('A good area', 'a'.repeat(51)),
      true,
    );
  });

  it('keeps content with detected profanity in manual moderation', () => {
    assert.equal(
      isEligibleForAutomaticApproval(
        'A review',
        `This area is ${'quite '.repeat(10)}shit!`,
      ),
      false,
    );
  });

  it('detects profanity hidden by punctuation, repeated letters, or common number substitutions', () => {
    for (const word of ['f.u.c.k', 'shiiit', 'b1tch', 'sh!t', 'asshole']) {
      assert.equal(
        isEligibleForAutomaticApproval(
          'A review',
          `This area is ${'quite '.repeat(10)}${word}.`,
        ),
        false,
        `expected ${word} to require manual moderation`,
      );
    }
  });

  it('checks Russian profanity and all user-written review fields', () => {
    assert.equal(
      isEligibleForAutomaticApproval(
        'A clean title',
        `This area is ${'quite '.repeat(10)}pleasant.`,
        ['Convenient shops', 'сука'],
      ),
      false,
    );
  });

  it('allows longer clean content to be automatically approved', () => {
    assert.equal(
      isEligibleForAutomaticApproval(
        'Good transport',
        'The station is nearby and the neighbourhood is pleasant.',
      ),
      true,
    );
  });

  it('does not reject clean words containing profanity-like substrings', () => {
    assert.equal(
      isEligibleForAutomaticApproval(
        'Scunthorpe area',
        'The local class and passage are well maintained, with pleasant transport.',
      ),
      true,
    );
  });
});
