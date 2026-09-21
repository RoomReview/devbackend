DO $$ BEGIN
  CREATE TYPE "ScoreStatus" AS ENUM ('WAITING', 'GENERATING', 'READY', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "score_reports" (
    "score_report_id" TEXT NOT NULL,
    "borough_id" TEXT,
    "postcode_id" TEXT,
    "name" TEXT,
    "description" TEXT,
    "status" "ScoreStatus" NOT NULL DEFAULT 'WAITING',
    "overallScore" DOUBLE PRECISION,
    "boroughScore" DOUBLE PRECISION,
    "postcodeScore" DOUBLE PRECISION,
    "scoreBreakdown" JSONB,
    "reportData" JSONB,
    "failureReason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "score_reports_pkey" PRIMARY KEY ("score_report_id")
);

ALTER TABLE "score_reports" ADD COLUMN IF NOT EXISTS "user_id" UUID;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "report_orders" (
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score_report_id" TEXT NOT NULL,
    "stripe_session_id" TEXT,
    "stripe_payment_intent" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "report_orders_pkey" PRIMARY KEY ("order_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "report_orders_stripe_session_id_key" ON "report_orders"("stripe_session_id");
CREATE INDEX IF NOT EXISTS "report_orders_user_id_created_at_idx" ON "report_orders"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "report_orders_score_report_id_idx" ON "report_orders"("score_report_id");
ALTER TABLE "score_reports" ADD CONSTRAINT "score_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_orders" ADD CONSTRAINT "report_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_orders" ADD CONSTRAINT "report_orders_score_report_id_fkey" FOREIGN KEY ("score_report_id") REFERENCES "score_reports"("score_report_id") ON DELETE CASCADE ON UPDATE CASCADE;