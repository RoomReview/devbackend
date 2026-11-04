import prisma from '@config/database';
import {
  getAwinPublisherAccounts,
  getAwinTransactions,
  type AwinPublisherAccount,
  type AwinTransactionDateType,
} from '@/services/awin-api.service';

export interface AdminAffiliateTransaction {
  transactionId: string;
  advertiserId: string;
  advertiserName: string;
  clickReference: string | null;
  rewardMatched: boolean;
  status: string;
  commission: string | null;
  currency: string | null;
  transactionAt: Date;
  validationAt: Date | null;
  syncedAt: Date;
}

export const listAwinPublisherAccounts = (): Promise<AwinPublisherAccount[]> =>
  getAwinPublisherAccounts();

export const syncAwinTransactions = async (
  publisherId: number,
  startDate: Date,
  endDate: Date,
  dateType: AwinTransactionDateType,
): Promise<{ fetched: number; matched: number; unmatched: number }> => {
  const transactions = await getAwinTransactions(
    publisherId,
    startDate,
    endDate,
    dateType,
  );
  let matched = 0;

  await prisma.$transaction(async (transaction) => {
    for (const item of transactions) {
      const result = await transaction.$queryRaw<Array<{ matched: boolean }>>`
        INSERT INTO affiliate_transactions (
          transaction_id, advertiser_id, advertiser_name, click_reference, reward_grant_id,
          status, commission, currency, transaction_at, validation_at, synced_at
        )
        VALUES (
          ${item.transactionId}::bigint,
          ${item.advertiserId}::bigint,
          ${item.advertiserName},
          ${item.clickReference},
          (
            SELECT reward_grant_id
            FROM review_reward_grants
            WHERE click_reference = ${item.clickReference}
          ),
          ${item.status},
          ${item.commission},
          ${item.currency},
          ${item.transactionAt},
          ${item.validationAt},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (transaction_id) DO UPDATE SET
          advertiser_id = EXCLUDED.advertiser_id,
          advertiser_name = EXCLUDED.advertiser_name,
          click_reference = EXCLUDED.click_reference,
          reward_grant_id = EXCLUDED.reward_grant_id,
          status = EXCLUDED.status,
          commission = EXCLUDED.commission,
          currency = EXCLUDED.currency,
          transaction_at = EXCLUDED.transaction_at,
          validation_at = EXCLUDED.validation_at,
          synced_at = CURRENT_TIMESTAMP
        RETURNING reward_grant_id IS NOT NULL AS matched
      `;
      if (result[0]?.matched) {
        matched += 1;
      }
    }
  });

  return {
    fetched: transactions.length,
    matched,
    unmatched: transactions.length - matched,
  };
};

export const listAdminAwinTransactions = async (
  limit: number,
): Promise<AdminAffiliateTransaction[]> => {
  const rows = await prisma.$queryRaw<
    Array<{
      transactionId: bigint;
      advertiserId: bigint;
      advertiserName: string;
      clickReference: string | null;
      rewardMatched: boolean;
      status: string;
      commission: { toString(): string } | null;
      currency: string | null;
      transactionAt: Date;
      validationAt: Date | null;
      syncedAt: Date;
    }>
  >`
    SELECT transaction_id AS "transactionId", advertiser_id AS "advertiserId",
      advertiser_name AS "advertiserName", click_reference AS "clickReference",
      reward_grant_id IS NOT NULL AS "rewardMatched", status, commission,
      currency, transaction_at AS "transactionAt", validation_at AS "validationAt",
      synced_at AS "syncedAt"
    FROM affiliate_transactions
    ORDER BY transaction_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    transactionId: row.transactionId.toString(),
    advertiserId: row.advertiserId.toString(),
    commission: row.commission?.toString() ?? null,
  }));
};
