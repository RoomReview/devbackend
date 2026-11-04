CREATE TABLE "affiliate_offers" (
  "offer_id" UUID NOT NULL,
  "store_name" TEXT NOT NULL,
  "advertiser_name" TEXT NOT NULL,
  "logo_url" TEXT,
  "description" TEXT NOT NULL,
  "discount_details" TEXT,
  "tracking_url" TEXT NOT NULL,
  "awin_approved" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_offers_pkey" PRIMARY KEY ("offer_id")
);

CREATE INDEX "affiliate_offers_is_active_awin_approved_idx"
ON "affiliate_offers"("is_active", "awin_approved");

CREATE TABLE "review_reward_grants" (
  "reward_grant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "review_id" UUID,
  "offer_id" UUID,
  "click_reference" TEXT,
  "redeemed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_reward_grants_pkey" PRIMARY KEY ("reward_grant_id")
);

CREATE UNIQUE INDEX "review_reward_grants_review_id_key"
ON "review_reward_grants"("review_id");
CREATE UNIQUE INDEX "review_reward_grants_click_reference_key"
ON "review_reward_grants"("click_reference");
CREATE INDEX "review_reward_grants_user_id_redeemed_at_created_at_idx"
ON "review_reward_grants"("user_id", "redeemed_at", "created_at");

ALTER TABLE "review_reward_grants"
ADD CONSTRAINT "review_reward_grants_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_reward_grants"
ADD CONSTRAINT "review_reward_grants_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "reviews"("review_id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "review_reward_grants"
ADD CONSTRAINT "review_reward_grants_offer_id_fkey"
FOREIGN KEY ("offer_id") REFERENCES "affiliate_offers"("offer_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "review_reward_grants" (
  "reward_grant_id",
  "user_id",
  "review_id"
)
SELECT
  gen_random_uuid(),
  "author_id",
  "review_id"
FROM "reviews"
WHERE "status" = 'APPROVED';
