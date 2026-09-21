import { randomUUID } from 'node:crypto';
import prisma from '@config/database';

export type BillingStatus = 'INCOMPLETE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';

export interface BillingSubscriptionRow {
  billingSubscriptionId: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  status: BillingStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export const findBillingSubscription = async (userId: string) => {
  const rows = await prisma.$queryRaw<BillingSubscriptionRow[]>`
    SELECT billing_subscription_id AS "billingSubscriptionId", user_id AS "userId",
      stripe_customer_id AS "stripeCustomerId", stripe_subscription_id AS "stripeSubscriptionId",
      status, current_period_end AS "currentPeriodEnd", cancel_at_period_end AS "cancelAtPeriodEnd"
    FROM billing_subscriptions WHERE user_id = ${userId}::uuid LIMIT 1
  `;
  return rows[0] ?? null;
};

export const findBillingSubscriptionByStripeId = async (stripeSubscriptionId: string) => {
  const rows = await prisma.$queryRaw<BillingSubscriptionRow[]>`
    SELECT billing_subscription_id AS "billingSubscriptionId", user_id AS "userId",
      stripe_customer_id AS "stripeCustomerId", stripe_subscription_id AS "stripeSubscriptionId",
      status, current_period_end AS "currentPeriodEnd", cancel_at_period_end AS "cancelAtPeriodEnd"
    FROM billing_subscriptions WHERE stripe_subscription_id = ${stripeSubscriptionId} LIMIT 1
  `;
  return rows[0] ?? null;
};

export const saveBillingSubscription = async (data: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  status: BillingStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}) => {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO billing_subscriptions
      (billing_subscription_id, user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end)
    VALUES (${id}::uuid, ${data.userId}::uuid, ${data.stripeCustomerId}, ${data.stripeSubscriptionId}, ${data.status}::"BillingSubscriptionStatus", ${data.currentPeriodEnd}, ${data.cancelAtPeriodEnd})
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = CURRENT_TIMESTAMP
  `;
  return findBillingSubscription(data.userId);
};

export const updateBillingSubscription = async (stripeSubscriptionId: string, data: {
  status: BillingStatus;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) => {
  await prisma.$executeRaw`
    UPDATE billing_subscriptions
    SET status = ${data.status}::"BillingSubscriptionStatus",
      current_period_end = COALESCE(${data.currentPeriodEnd ?? null}, current_period_end),
      cancel_at_period_end = COALESCE(${data.cancelAtPeriodEnd ?? null}, cancel_at_period_end),
      updated_at = CURRENT_TIMESTAMP
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
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

export const consumeReportCredit = async (userId: string, scoreReportId: string) => {
  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$executeRaw`
      INSERT INTO report_credit_consumptions (report_credit_consumption_id, user_id, score_report_id)
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${scoreReportId})
      ON CONFLICT (score_report_id) DO NOTHING
    `;
    if (inserted === 0) return true;

    const credits = await tx.$queryRaw<Array<{ userCreditsId: string; balance: number }>>`
      SELECT user_credits_id AS "userCreditsId", credits_balance AS balance
      FROM user_credits WHERE user_id = ${userId}::uuid LIMIT 1
    `;
    if (!credits[0] || credits[0].balance < 1) {
      await tx.$executeRaw`DELETE FROM report_credit_consumptions WHERE score_report_id = ${scoreReportId}`;
      return false;
    }
    const balanceAfter = credits[0].balance - 1;
    await tx.$executeRaw`
      UPDATE user_credits SET credits_balance = ${balanceAfter}, updated_at = CURRENT_TIMESTAMP
      WHERE user_credits_id = ${credits[0].userCreditsId}::uuid
    `;
    await tx.$executeRaw`
      INSERT INTO credit_transactions
        (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${credits[0].userCreditsId}::uuid, -1, 'DOWNLOAD', 'Report credit used', ${balanceAfter}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    return true;
  });
};

export const getBillingStatus = async (userId: string) => {
  const subscription = await findBillingSubscription(userId);
  const users = await prisma.$queryRaw<Array<{ trialStartedAt: Date | null; trialEndsAt: Date | null; creditsBalance: number | null }>>`
    SELECT users.trial_started_at AS "trialStartedAt", users.trial_ends_at AS "trialEndsAt",
      user_credits.credits_balance AS "creditsBalance"
    FROM users LEFT JOIN user_credits ON user_credits.user_id = users.user_id
    WHERE users.user_id = ${userId}::uuid LIMIT 1
  `;
  const trial = users[0] ?? { trialStartedAt: null, trialEndsAt: null, creditsBalance: 0 };
  const trialActive = Boolean(trial.trialEndsAt && trial.trialEndsAt > new Date());
  return { trial, trialActive, creditsBalance: trial.creditsBalance ?? 0, subscription };
};
