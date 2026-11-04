DROP INDEX IF EXISTS "affiliate_offers_awin_publisher_promotion_key";

ALTER TABLE "affiliate_offers"
  DROP COLUMN IF EXISTS "awin_publisher_id",
  DROP COLUMN IF EXISTS "awin_promotion_id",
  DROP COLUMN IF EXISTS "awin_advertiser_id",
  DROP COLUMN IF EXISTS "awin_starts_at",
  DROP COLUMN IF EXISTS "awin_ends_at";
