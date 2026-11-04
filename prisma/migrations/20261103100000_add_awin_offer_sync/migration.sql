ALTER TABLE "affiliate_offers"
  ADD COLUMN "awin_publisher_id" BIGINT,
  ADD COLUMN "awin_promotion_id" BIGINT,
  ADD COLUMN "awin_advertiser_id" BIGINT,
  ADD COLUMN "awin_starts_at" TIMESTAMPTZ(3),
  ADD COLUMN "awin_ends_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "affiliate_offers_awin_publisher_promotion_key"
ON "affiliate_offers"("awin_publisher_id", "awin_promotion_id");
