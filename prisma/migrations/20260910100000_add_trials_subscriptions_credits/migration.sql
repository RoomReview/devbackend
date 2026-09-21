ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'STANDARD', 'PRO', 'PREMIUM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'SUBSCRIPTION', 'DOWNLOAD', 'AI_SUMMARY', 'VALUATION', 'REFUND', 'BONUS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "user_credits" (
    "user_credits_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credits_balance" INTEGER NOT NULL DEFAULT 15,
    "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "ai_summary_used" INTEGER NOT NULL DEFAULT 0,
    "ai_summary_limit" INTEGER NOT NULL DEFAULT 0,
    "plan_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_credits_pkey" PRIMARY KEY ("user_credits_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_credits_user_id_key" ON "user_credits"("user_id");
DO $$ BEGIN
  ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "credit_transactions" (
    "credit_transaction_id" UUID NOT NULL,
    "user_credits_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("credit_transaction_id")
);
CREATE INDEX IF NOT EXISTS "credit_transactions_user_credits_id_idx" ON "credit_transactions"("user_credits_id");
DO $$ BEGIN
  ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_credits_id_fkey" FOREIGN KEY ("user_credits_id") REFERENCES "user_credits"("user_credits_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "report_credit_consumptions" (
  "report_credit_consumption_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "score_report_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_credit_consumptions_pkey" PRIMARY KEY ("report_credit_consumption_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "report_credit_consumptions_score_report_id_key" ON "report_credit_consumptions"("score_report_id");
ALTER TABLE "report_credit_consumptions" ADD CONSTRAINT "report_credit_consumptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_credit_consumptions" ADD CONSTRAINT "report_credit_consumptions_score_report_id_fkey" FOREIGN KEY ("score_report_id") REFERENCES "score_reports"("score_report_id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ BEGIN
  CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
    "billing_subscription_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL,
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("billing_subscription_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscriptions_user_id_key" ON "billing_subscriptions"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscriptions_stripe_subscription_id_key" ON "billing_subscriptions"("stripe_subscription_id");
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "billing_credit_grants" (
    "billing_credit_grant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "stripe_invoice_id" TEXT,
    "credits" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_credit_grants_pkey" PRIMARY KEY ("billing_credit_grant_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_credit_grants_stripe_event_id_key" ON "billing_credit_grants"("stripe_event_id");
ALTER TABLE "billing_credit_grants" ADD CONSTRAINT "billing_credit_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;