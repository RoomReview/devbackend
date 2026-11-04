CREATE TABLE "affiliate_transactions" (
  "transaction_id" BIGINT NOT NULL,
  "advertiser_id" BIGINT NOT NULL,
  "advertiser_name" TEXT NOT NULL,
  "click_reference" TEXT,
  "reward_grant_id" UUID,
  "status" TEXT NOT NULL,
  "commission" DECIMAL(14, 4),
  "currency" VARCHAR(3),
  "transaction_at" TIMESTAMP(3) NOT NULL,
  "validation_at" TIMESTAMP(3),
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_transactions_pkey" PRIMARY KEY ("transaction_id"),
  CONSTRAINT "affiliate_transactions_status_check"
    CHECK ("status" IN ('pending', 'approved', 'declined', 'deleted'))
);

CREATE INDEX "affiliate_transactions_status_transaction_at_idx"
ON "affiliate_transactions"("status", "transaction_at");
CREATE INDEX "affiliate_transactions_reward_grant_id_idx"
ON "affiliate_transactions"("reward_grant_id");

ALTER TABLE "affiliate_transactions"
ADD CONSTRAINT "affiliate_transactions_reward_grant_id_fkey"
FOREIGN KEY ("reward_grant_id") REFERENCES "review_reward_grants"("reward_grant_id")
ON DELETE SET NULL ON UPDATE CASCADE;
