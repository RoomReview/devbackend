import config from '@config/index';
import prisma from '@config/database';
import {
  getAwinPromotions,
  type AwinPromotion,
} from '@/services/awin-api.service';
import { ValidationError } from '@/utils/custom-error';
import logger from '@/utils/logger';

const OFFER_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

export interface AwinOfferSyncResult {
  fetched: number;
  joined: number;
  created: number;
  updated: number;
  unjoinedAdvertisers: number;
}

const toOfferDescription = (promotion: AwinPromotion): string =>
  [
    promotion.title,
    promotion.description === promotion.title ? null : promotion.description,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 2000);

const toDiscountDetails = (promotion: AwinPromotion): string | null => {
  const details = [
    promotion.terms,
    promotion.voucherCode ? `Voucher code: ${promotion.voucherCode}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 1000);
  return details || null;
};

export const syncAwinOffers = async (
  publisherId: number,
): Promise<AwinOfferSyncResult> => {
  if (!Number.isSafeInteger(publisherId) || publisherId <= 0) {
    throw new ValidationError({
      message: 'A valid Awin publisher ID is required.',
      code: 'VALIDATION_ERROR',
    });
  }

  const promotions = await getAwinPromotions(publisherId);
  const joinedPromotions = promotions.filter((promotion) => promotion.joined);
  const unjoinedAdvertiserIds = [
    ...new Set(
      promotions
        .filter((promotion) => !promotion.joined)
        .map((promotion) => promotion.advertiserId),
    ),
  ];
  let created = 0;

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      UPDATE affiliate_offers
      SET awin_approved = false, updated_at = CURRENT_TIMESTAMP
      WHERE awin_publisher_id = ${publisherId}::bigint
        AND awin_promotion_id IS NOT NULL
    `;

    for (const promotion of joinedPromotions) {
      const result = await transaction.$queryRaw<Array<{ created: boolean }>>`
        INSERT INTO affiliate_offers (
          offer_id, store_name, advertiser_name, description, discount_details,
          tracking_url, awin_approved, is_active, awin_publisher_id,
          awin_promotion_id, awin_advertiser_id, awin_starts_at, awin_ends_at,
          created_at, updated_at
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${promotion.advertiserName},
          ${promotion.advertiserName},
          ${toOfferDescription(promotion)},
          ${toDiscountDetails(promotion)},
          ${promotion.trackingUrl},
          true,
          true,
          ${publisherId}::bigint,
          ${promotion.promotionId}::bigint,
          ${promotion.advertiserId}::bigint,
          ${promotion.startsAt},
          ${promotion.endsAt},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (awin_publisher_id, awin_promotion_id) DO UPDATE SET
          store_name = EXCLUDED.store_name,
          advertiser_name = EXCLUDED.advertiser_name,
          description = EXCLUDED.description,
          discount_details = EXCLUDED.discount_details,
          tracking_url = EXCLUDED.tracking_url,
          awin_approved = true,
          awin_advertiser_id = EXCLUDED.awin_advertiser_id,
          awin_starts_at = EXCLUDED.awin_starts_at,
          awin_ends_at = EXCLUDED.awin_ends_at,
          updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS created
      `;
      if (result[0]?.created) {
        created += 1;
      }
    }
  });

  return {
    fetched: promotions.length,
    joined: joinedPromotions.length,
    created,
    updated: joinedPromotions.length - created,
    unjoinedAdvertisers: unjoinedAdvertiserIds.length,
  };
};

let workerStarted = false;

export const startAwinOfferSyncWorker = (): void => {
  if (workerStarted) {
    return;
  }
  workerStarted = true;

  const publisherId = config.awinPublisherId;
  if (!Number.isSafeInteger(publisherId) || publisherId <= 0) {
    logger.info(
      { service: 'AwinOfferSync', function: 'startAwinOfferSyncWorker' },
      'Automatic Awin offer sync is disabled; configure AWIN_PUBLISHER_ID to enable it',
    );
    return;
  }

  const run = async () => {
    try {
      const result = await syncAwinOffers(publisherId);
      logger.info(
        { service: 'AwinOfferSync', function: 'run' },
        'Awin offers synchronized',
        result,
      );
    } catch (error) {
      logger.error(
        { service: 'AwinOfferSync', function: 'run' },
        'Automatic Awin offer sync failed; retry scheduled',
        { error },
      );
    } finally {
      setTimeout(() => {
        void run();
      }, OFFER_SYNC_INTERVAL_MS).unref();
    }
  };

  void run();
};
