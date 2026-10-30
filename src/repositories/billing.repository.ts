import { randomUUID } from 'node:crypto';
import prisma from '@config/database';
import config from '@config/index';
import type { ScoreReportUpdateInput } from '@/generated/prisma/models';

export type BillingStatus = 'INCOMPLETE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';

export interface BillingSubscriptionRow {
  billingSubscriptionId: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  status: BillingStatus;
  planId: string | null;
  seatLimit: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export const getReportCreditAccountUserId = async (
  userId: string,
  queryable: Pick<typeof prisma, '$queryRaw'> = prisma,
) => {
  const rows = await queryable.$queryRaw<Array<{ accountUserId: string }>>`
    SELECT COALESCE(
      (
        SELECT agencies.owner_user_id
        FROM user_agency
        JOIN agencies ON agencies.agency_id = user_agency.agency_id
        WHERE user_agency.user_id = ${userId}::uuid
          AND agencies.owner_user_id IS NOT NULL
        ORDER BY user_agency.created_at ASC
        LIMIT 1
      ),
      ${userId}::uuid
    ) AS "accountUserId"
  `;
  return rows[0]?.accountUserId ?? userId;
};

export const findBillingSubscription = async (userId: string) => {
  const accountUserId = await getReportCreditAccountUserId(userId);
  const rows = await prisma.$queryRaw<BillingSubscriptionRow[]>`
    SELECT billing_subscription_id AS "billingSubscriptionId", user_id AS "userId",
      stripe_customer_id AS "stripeCustomerId", stripe_subscription_id AS "stripeSubscriptionId",
      status, plan_id AS "planId", seat_limit AS "seatLimit",
      current_period_end AS "currentPeriodEnd", cancel_at_period_end AS "cancelAtPeriodEnd"
    FROM billing_subscriptions WHERE user_id = ${accountUserId}::uuid LIMIT 1
  `;
  return rows[0] ?? null;
};

export const findBillingSubscriptionByStripeId = async (stripeSubscriptionId: string) => {
  const rows = await prisma.$queryRaw<BillingSubscriptionRow[]>`
    SELECT billing_subscription_id AS "billingSubscriptionId", user_id AS "userId",
      stripe_customer_id AS "stripeCustomerId", stripe_subscription_id AS "stripeSubscriptionId",
      status, plan_id AS "planId", seat_limit AS "seatLimit",
      current_period_end AS "currentPeriodEnd", cancel_at_period_end AS "cancelAtPeriodEnd"
    FROM billing_subscriptions WHERE stripe_subscription_id = ${stripeSubscriptionId} LIMIT 1
  `;
  return rows[0] ?? null;
};

export const saveBillingSubscription = async (data: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  status: BillingStatus;
  planId: string | null;
  seatLimit: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}) => {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO billing_subscriptions
      (billing_subscription_id, user_id, stripe_customer_id, stripe_subscription_id, status, plan_id, seat_limit, current_period_end, cancel_at_period_end)
    VALUES (${id}::uuid, ${data.userId}::uuid, ${data.stripeCustomerId}, ${data.stripeSubscriptionId}, ${data.status}::"BillingSubscriptionStatus", ${data.planId}, ${data.seatLimit}, ${data.currentPeriodEnd}, ${data.cancelAtPeriodEnd})
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      plan_id = EXCLUDED.plan_id,
      seat_limit = EXCLUDED.seat_limit,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = CURRENT_TIMESTAMP
  `;
  return findBillingSubscription(data.userId);
};

export const updateBillingSubscription = async (stripeSubscriptionId: string, data: {
  status: BillingStatus;
  planId?: string | null;
  seatLimit?: number;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) => {
  await prisma.$executeRaw`
    UPDATE billing_subscriptions
    SET status = ${data.status}::"BillingSubscriptionStatus",
      current_period_end = COALESCE(${data.currentPeriodEnd ?? null}, current_period_end),
      plan_id = COALESCE(${data.planId ?? null}, plan_id),
      seat_limit = COALESCE(${data.seatLimit ?? null}, seat_limit),
      cancel_at_period_end = COALESCE(${data.cancelAtPeriodEnd ?? null}, cancel_at_period_end),
      updated_at = CURRENT_TIMESTAMP
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
};

export const consumeEarlyAccessDiscount = async (userId: string) => {
  await prisma.$executeRaw`
    UPDATE users
    SET early_access_discount_eligible = false, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}::uuid AND early_access_discount_eligible = true
  `;
};

export const grantSubscriptionCredits = async (data: {
  userId: string;
  eventId: string;
  invoiceId: string | null;
  credits: number;
}) => {
  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$executeRaw`
      INSERT INTO billing_credit_grants (billing_credit_grant_id, user_id, stripe_event_id, stripe_invoice_id, credits)
      VALUES (${randomUUID()}::uuid, ${data.userId}::uuid, ${data.eventId}, ${data.invoiceId}, ${data.credits})
      ON CONFLICT (stripe_event_id) DO NOTHING
    `;
    if (inserted === 0) return false;

    const existing = await tx.$queryRaw<Array<{ userCreditsId: string; balance: number }>>`
      SELECT user_credits_id AS "userCreditsId", credits_balance AS balance
      FROM user_credits WHERE user_id = ${data.userId}::uuid LIMIT 1
    `;
    const balanceBefore = existing[0]?.balance ?? 0;
    const userCreditsId = existing[0]?.userCreditsId ?? randomUUID();
    if (existing.length === 0) {
      await tx.$executeRaw`
        INSERT INTO user_credits (user_credits_id, user_id, credits_balance, subscription_plan, created_at, updated_at)
        VALUES (${userCreditsId}::uuid, ${data.userId}::uuid, ${data.credits}, 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    } else {
      await tx.$executeRaw`
        UPDATE user_credits SET credits_balance = credits_balance + ${data.credits}, updated_at = CURRENT_TIMESTAMP
        WHERE user_credits_id = ${userCreditsId}::uuid
      `;
    }
    await tx.$executeRaw`
      INSERT INTO credit_transactions
        (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${userCreditsId}::uuid, ${data.credits}, 'SUBSCRIPTION', 'Monthly report subscription credits', ${balanceBefore + data.credits}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    return true;
  });
};

export const hasReportCreditConsumption = async (scoreReportId: string) => {
  const rows = await prisma.$queryRaw<Array<{ consumed: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM report_credit_consumptions
      WHERE score_report_id = ${scoreReportId}
    ) AS consumed
  `;
  return rows[0]?.consumed ?? false;
};

export const completeGeneratedReport = async (
  userId: string,
  scoreReportId: string,
  reportUpdate: ScoreReportUpdateInput,
) => {
  return prisma.$transaction(async (tx) => {
    const reportOwners = await tx.$queryRaw<Array<{ userId: string }>>`
      SELECT user_id AS "userId" FROM score_reports
      WHERE score_report_id = ${scoreReportId}
      LIMIT 1 FOR UPDATE
    `;
    if (reportOwners[0]?.userId !== userId) {
      return false;
    }

    const paidOrders = await tx.$queryRaw<Array<{ orderId: string }>>`
      SELECT order_id AS "orderId" FROM report_orders
      WHERE score_report_id = ${scoreReportId}
        AND user_id = ${userId}::uuid AND status = 'PAID'
      LIMIT 1
    `;
    const existingConsumption = await tx.$queryRaw<Array<{ consumptionId: string }>>`
      SELECT report_credit_consumption_id AS "consumptionId"
      FROM report_credit_consumptions
      WHERE score_report_id = ${scoreReportId}
      LIMIT 1
    `;

    if (paidOrders.length === 0 && existingConsumption.length === 0) {
      const accountUserId = await getReportCreditAccountUserId(userId, tx);
      const credits = await tx.$queryRaw<Array<{ userCreditsId: string; balance: number }>>`
        SELECT user_credits_id AS "userCreditsId", credits_balance AS balance
        FROM user_credits
        WHERE user_id = ${accountUserId}::uuid
        LIMIT 1
        FOR UPDATE
      `;
      if (!credits[0] || credits[0].balance < 1) {
        return false;
      }

      const inserted = await tx.$executeRaw`
        INSERT INTO report_credit_consumptions
          (report_credit_consumption_id, user_id, score_report_id)
        VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${scoreReportId})
        ON CONFLICT (score_report_id) DO NOTHING
      `;
      if (inserted > 0) {
        const balanceAfter = credits[0].balance - 1;
        await tx.$executeRaw`
          UPDATE user_credits SET credits_balance = ${balanceAfter}, updated_at = CURRENT_TIMESTAMP
          WHERE user_credits_id = ${credits[0].userCreditsId}::uuid
        `;
        await tx.$executeRaw`
          INSERT INTO credit_transactions
            (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
          VALUES (
            ${randomUUID()}::uuid, ${credits[0].userCreditsId}::uuid, -1,
            'DOWNLOAD', 'Generated report credit used', ${balanceAfter},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
      }
    }

    await tx.scoreReport.update({
      where: { scoreReportId },
      data: reportUpdate,
    });
    return true;
  });
};

export const grantRegistrationReportCredits = async (userId: string) => {
  return prisma.$transaction(async (tx) => {
    const eligibleUsers = await tx.$queryRaw<Array<{ userId: string; role: string }>>`
      SELECT user_id AS "userId", role
      FROM users
      WHERE user_id = ${userId}::uuid
        AND (
          (
            role IN ('TENANT', 'LANDLORD')
            AND trial_ends_at > CURRENT_TIMESTAMP
            AND NOT EXISTS (
              SELECT 1 FROM billing_credit_grants
              WHERE billing_credit_grants.user_id = users.user_id
                AND billing_credit_grants.stripe_event_id = 'registration-trial:' || users.user_id::text
            )
          )
          OR (
            role IN ('AGENCY', 'AGENT')
            AND early_access_discount_eligible = true
            AND NOT EXISTS (
              SELECT 1 FROM billing_credit_grants
              WHERE billing_credit_grants.user_id = users.user_id
                AND billing_credit_grants.stripe_event_id = 'early-access-registration:' || users.user_id::text
            )
          )
        )
      LIMIT 1
    `;
    if (eligibleUsers.length === 0) {
      return false;
    }

    const isEarlyAccess = eligibleUsers[0].role === 'AGENCY' || eligibleUsers[0].role === 'AGENT';
    const credits = isEarlyAccess ? 3 : 1;
    const eventId = isEarlyAccess
      ? `early-access-registration:${userId}`
      : `registration-trial:${userId}`;
    const description = isEarlyAccess
      ? 'Early access registration: three free reports'
      : 'Registration bonus: one free report';
    const grantInserted = await tx.$executeRaw`
      INSERT INTO billing_credit_grants
        (billing_credit_grant_id, user_id, stripe_event_id, stripe_invoice_id, credits)
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${eventId}, NULL, ${credits})
      ON CONFLICT (stripe_event_id) DO NOTHING
    `;
    if (grantInserted === 0) {
      return false;
    }

    const existingCredits = await tx.$queryRaw<Array<{ userCreditsId: string; balance: number }>>`
      SELECT user_credits_id AS "userCreditsId", credits_balance AS balance
      FROM user_credits
      WHERE user_id = ${userId}::uuid
      LIMIT 1
      FOR UPDATE
    `;
    const userCreditsId = existingCredits[0]?.userCreditsId ?? randomUUID();
    const balanceAfter = (existingCredits[0]?.balance ?? 0) + credits;
    if (existingCredits.length > 0) {
      await tx.$executeRaw`
        UPDATE user_credits
        SET credits_balance = ${balanceAfter}, updated_at = CURRENT_TIMESTAMP
        WHERE user_credits_id = ${userCreditsId}::uuid
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO user_credits
          (user_credits_id, user_id, credits_balance, subscription_plan, created_at, updated_at)
        VALUES (${userCreditsId}::uuid, ${userId}::uuid, ${balanceAfter}, 'FREE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }
    await tx.$executeRaw`
      INSERT INTO credit_transactions
        (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${userCreditsId}::uuid, ${credits}, 'BONUS', ${description}, ${balanceAfter}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    return true;
  });
};

export const getBillingStatus = async (userId: string) => {
  await grantRegistrationReportCredits(userId);
  const accountUserId = await getReportCreditAccountUserId(userId);
  const subscription = await findBillingSubscription(userId);
  const users = await prisma.$queryRaw<Array<{
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
    creditsBalance: number | null;
    earlyAccessDiscountEligible: boolean;
  }>>`
    SELECT requester.trial_started_at AS "trialStartedAt",
      requester.trial_ends_at AS "trialEndsAt",
      user_credits.credits_balance AS "creditsBalance",
      account_user.early_access_discount_eligible AS "earlyAccessDiscountEligible"
    FROM users AS requester
    LEFT JOIN users AS account_user ON account_user.user_id = ${accountUserId}::uuid
    LEFT JOIN user_credits ON user_credits.user_id = ${accountUserId}::uuid
    WHERE requester.user_id = ${userId}::uuid LIMIT 1
  `;
  const trial = users[0] ?? {
    trialStartedAt: null,
    trialEndsAt: null,
    creditsBalance: 0,
    earlyAccessDiscountEligible: false,
  };
  const trialActive = Boolean(trial.trialEndsAt && trial.trialEndsAt > new Date());
  const monthlyReportAllowance = subscription?.status === 'ACTIVE'
    ? subscription.seatLimit > 0
      ? (subscription.seatLimit + 1) * 10
      : config.stripeSubscriptionCredits
    : 0;
  return {
    trial,
    trialActive,
    creditsBalance: trial.creditsBalance ?? 0,
    monthlyReportAllowance,
    earlyAccessDiscountEligible: trial.earlyAccessDiscountEligible,
    subscription: subscription ? {
      ...subscription,
      seatLimit: subscription.seatLimit ?? 0,
    } : null,
  };
};
