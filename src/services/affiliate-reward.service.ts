import prisma from '@config/database';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import {
  getAchievements,
  getProfileProgress,
} from '@/services/profile-progress';
import type { AffiliateOfferInput } from '@/dto/affiliate-reward.dto';

export interface AffiliateOffer {
  offerId: string;
  storeName: string;
  advertiserName: string;
  logoUrl: string | null;
  description: string;
  discountDetails: string | null;
  trackingUrl?: string;
  awinApproved?: boolean;
  isActive?: boolean;
  awinPromotionId?: string | null;
  awinStartsAt?: Date | null;
  awinEndsAt?: Date | null;
  isImportedFromAwin?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ContributionCountRow {
  approvedReviews: bigint;
  readyReports: bigint;
}

interface RewardBalanceRow {
  availableRewards: bigint;
}

interface RewardsAccessRow {
  rewardsUnlocked: boolean;
}

interface RewardHistoryRow {
  rewardGrantId: string;
  reviewId: string | null;
  earnedAt: Date;
  redeemedAt: Date | null;
  storeName: string | null;
  voucherCode: string | null;
}

interface RedeemRow {
  trackingUrl: string;
  clickReference: string;
  voucherCode: string | null;
}

interface PublicOfferRow extends AffiliateOffer {
  voucherCode: string | null;
}

export interface AdminAffiliateOffer extends AffiliateOffer {
  voucherCode: string | null;
}

export const removeVoucherCode = (
  text: string | null,
  voucherCode: string | null | undefined,
): string | null => {
  if (!text || !voucherCode?.trim()) {
    return text;
  }
  const escapedCode = voucherCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    text
      .replace(new RegExp(escapedCode, 'gi'), '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim() || null
  );
};

export const isRewardsAccessUnlocked = (
  persistentlyUnlocked: boolean,
  approvedReviewCount: number,
  rewardHistoryCount: number,
): boolean =>
  persistentlyUnlocked || approvedReviewCount > 0 || rewardHistoryCount > 0;

export const listActiveAffiliateOffers = async (): Promise<
  AffiliateOffer[]
> => {
  const offers = await prisma.$queryRaw<PublicOfferRow[]>`
  SELECT offer_id AS "offerId", store_name AS "storeName", advertiser_name AS "advertiserName",
    logo_url AS "logoUrl", description, discount_details AS "discountDetails",
    voucher_code AS "voucherCode"
  FROM affiliate_offers
  WHERE is_active = true AND awin_approved = true
    AND (awin_starts_at IS NULL OR awin_starts_at <= CURRENT_TIMESTAMP)
    AND (awin_ends_at IS NULL OR awin_ends_at > CURRENT_TIMESTAMP)
  ORDER BY store_name ASC
`;
  return offers.map(({ voucherCode, ...offer }) => ({
    ...offer,
    description:
      removeVoucherCode(offer.description, voucherCode) ??
      'Redeem your reward to reveal this offer.',
    discountDetails: removeVoucherCode(offer.discountDetails, voucherCode),
  }));
};

export const listAffiliateOffersForAdmin = async (): Promise<
  AdminAffiliateOffer[]
> => prisma.$queryRaw<AdminAffiliateOffer[]>`
  SELECT offer_id AS "offerId", store_name AS "storeName", advertiser_name AS "advertiserName",
    logo_url AS "logoUrl", description, discount_details AS "discountDetails",
    voucher_code AS "voucherCode",
    tracking_url AS "trackingUrl", awin_approved AS "awinApproved", is_active AS "isActive",
    awin_promotion_id::text AS "awinPromotionId",
    awin_starts_at AS "awinStartsAt", awin_ends_at AS "awinEndsAt",
    (awin_promotion_id IS NOT NULL) AS "isImportedFromAwin",
    created_at AS "createdAt", updated_at AS "updatedAt"
  FROM affiliate_offers
  ORDER BY created_at DESC
`;

export const createAffiliateOffer = async (
  offer: AffiliateOfferInput,
): Promise<AdminAffiliateOffer> => {
  const rows = await prisma.$queryRaw<AdminAffiliateOffer[]>`
    INSERT INTO affiliate_offers (
      offer_id, store_name, advertiser_name, logo_url, description, discount_details,
      voucher_code, tracking_url, awin_approved, is_active, created_at, updated_at
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${offer.storeName}, ${offer.advertiserName}, ${offer.logoUrl ?? null},
      ${offer.description}, ${offer.discountDetails ?? null}, ${offer.voucherCode ?? null}, ${offer.trackingUrl},
      ${offer.awinApproved}, ${offer.isActive}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING offer_id AS "offerId", store_name AS "storeName", advertiser_name AS "advertiserName",
      logo_url AS "logoUrl", description, discount_details AS "discountDetails",
      voucher_code AS "voucherCode",
      tracking_url AS "trackingUrl", awin_approved AS "awinApproved", is_active AS "isActive",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return rows[0];
};

export const updateAffiliateOffer = async (
  offerId: string,
  offer: AffiliateOfferInput,
): Promise<AdminAffiliateOffer> => {
  const rows = await prisma.$queryRaw<AdminAffiliateOffer[]>`
    UPDATE affiliate_offers
    SET store_name = ${offer.storeName},
      advertiser_name = ${offer.advertiserName},
      logo_url = ${offer.logoUrl ?? null},
      description = ${offer.description},
      discount_details = ${offer.discountDetails ?? null},
      voucher_code = ${offer.voucherCode ?? null},
      tracking_url = ${offer.trackingUrl},
      awin_approved = ${offer.awinApproved},
      is_active = ${offer.isActive},
      updated_at = CURRENT_TIMESTAMP
    WHERE offer_id = ${offerId}::uuid
    RETURNING offer_id AS "offerId", store_name AS "storeName", advertiser_name AS "advertiserName",
      logo_url AS "logoUrl", description, discount_details AS "discountDetails",
      voucher_code AS "voucherCode",
      tracking_url AS "trackingUrl", awin_approved AS "awinApproved", is_active AS "isActive",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  if (!rows[0]) {
    throw new EntityNotFoundError({
      message: 'Partner offer not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return rows[0];
};

export const getMyRewards = async (userId: string) => {
  const [counts, balance, access, offers, rewards] = await Promise.all([
    prisma.$queryRaw<ContributionCountRow[]>`
      SELECT
        (SELECT COUNT(*) FROM reviews WHERE author_id = ${userId}::uuid AND status = 'APPROVED')::bigint AS "approvedReviews",
        (SELECT COUNT(*) FROM score_reports WHERE user_id = ${userId}::uuid AND status = 'READY' AND deleted_at IS NULL)::bigint AS "readyReports"
    `,
    prisma.$queryRaw<RewardBalanceRow[]>`
      SELECT COUNT(*)::bigint AS "availableRewards"
      FROM review_reward_grants
      WHERE user_id = ${userId}::uuid AND redeemed_at IS NULL
    `,
    prisma.$queryRaw<RewardsAccessRow[]>`
      SELECT rewards_unlocked AS "rewardsUnlocked"
      FROM users
      WHERE user_id = ${userId}::uuid
    `,
    listActiveAffiliateOffers(),
    prisma.$queryRaw<RewardHistoryRow[]>`
      SELECT reward.reward_grant_id AS "rewardGrantId", reward.review_id AS "reviewId",
        reward.created_at AS "earnedAt", reward.redeemed_at AS "redeemedAt",
        offer.store_name AS "storeName",
        CASE WHEN reward.redeemed_at IS NOT NULL THEN offer.voucher_code ELSE NULL END AS "voucherCode"
      FROM review_reward_grants AS reward
      LEFT JOIN affiliate_offers AS offer ON offer.offer_id = reward.offer_id
      WHERE reward.user_id = ${userId}::uuid
      ORDER BY reward.created_at DESC
    `,
  ]);
  const approvedReviews = Number(counts[0]?.approvedReviews ?? 0n);
  const readyReports = Number(counts[0]?.readyReports ?? 0n);
  const hasRewardsAccess = isRewardsAccessUnlocked(
    access[0]?.rewardsUnlocked === true,
    approvedReviews,
    rewards.length,
  );

  return {
    profile: getProfileProgress(approvedReviews, readyReports),
    achievements: getAchievements(approvedReviews, readyReports),
    hasRewardsAccess,
    availableRewards: Number(balance[0]?.availableRewards ?? 0n),
    offers: hasRewardsAccess ? offers : [],
    rewards,
  };
};

export const redeemReviewReward = async (
  userId: string,
  rewardGrantId: string,
  offerId: string,
): Promise<{ trackingUrl: string; voucherCode: string | null }> => {
  const clickReference = crypto.randomUUID();
  const rows = await prisma.$transaction(
    (transaction) => transaction.$queryRaw<RedeemRow[]>`
    UPDATE review_reward_grants AS reward
    SET offer_id = offer.offer_id,
      click_reference = ${clickReference},
      redeemed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    FROM affiliate_offers AS offer
    WHERE reward.reward_grant_id = ${rewardGrantId}::uuid
      AND reward.user_id = ${userId}::uuid
      AND reward.redeemed_at IS NULL
      AND offer.offer_id = ${offerId}::uuid
      AND offer.is_active = true
      AND offer.awin_approved = true
      AND (offer.awin_starts_at IS NULL OR offer.awin_starts_at <= CURRENT_TIMESTAMP)
      AND (offer.awin_ends_at IS NULL OR offer.awin_ends_at > CURRENT_TIMESTAMP)
    RETURNING offer.tracking_url AS "trackingUrl",
      offer.voucher_code AS "voucherCode",
      reward.click_reference AS "clickReference"
  `,
  );

  if (!rows[0]) {
    throw new ValidationError({
      message:
        'This reward is no longer available, or the selected offer is inactive.',
      code: 'VALIDATION_ERROR',
    });
  }

  const destination = new URL(rows[0].trackingUrl);
  destination.searchParams.set('clickref', rows[0].clickReference);
  return {
    trackingUrl: destination.toString(),
    voucherCode: rows[0].voucherCode,
  };
};
