import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CreateAffiliateOfferDto,
  RedeemReviewRewardDto,
} from './affiliate-reward.dto.ts';

const validOffer = {
  storeName: 'Example London Store',
  advertiserName: 'Example Awin Advertiser',
  logoUrl: null,
  description: 'Shop the partner store through this offer.',
  discountDetails: null,
  trackingUrl: 'https://www.awin1.com/cread.php?awinmid=123',
  awinApproved: true,
  isActive: true,
};

describe('affiliate reward DTOs', () => {
  it('accepts secure Awin-approved offers', () => {
    assert.equal(CreateAffiliateOfferDto.safeParse(validOffer).success, true);
    assert.equal(
      CreateAffiliateOfferDto.safeParse({
        ...validOffer,
        trackingUrl: 'https://tidd.ly/awin-short-link',
      }).success,
      true,
    );
  });

  it('rejects active offers without Awin approval and arbitrary redirect URLs', () => {
    assert.equal(
      CreateAffiliateOfferDto.safeParse({ ...validOffer, awinApproved: false })
        .success,
      false,
    );
    assert.equal(
      CreateAffiliateOfferDto.safeParse({
        ...validOffer,
        trackingUrl: 'https://example.com/redirect',
      }).success,
      false,
    );
  });

  it('requires a valid selected offer when redeeming a reward', () => {
    assert.equal(
      RedeemReviewRewardDto.safeParse({
        offerId: '5c17acb7-31c8-45d2-8eb9-566e5c1e49b1',
      }).success,
      true,
    );
    assert.equal(
      RedeemReviewRewardDto.safeParse({ offerId: 'not-an-id' }).success,
      false,
    );
  });
});
