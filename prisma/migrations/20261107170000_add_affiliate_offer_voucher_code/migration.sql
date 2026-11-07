ALTER TABLE "affiliate_offers"
  ADD COLUMN "voucher_code" TEXT;

UPDATE "affiliate_offers"
SET
  "voucher_code" = (regexp_match(
    "discount_details",
    '(?i)Voucher code:[[:space:]]*([A-Z0-9_-]+)'
  ))[1],
  "discount_details" = btrim(regexp_replace(
    "discount_details",
    '(?i)[[:space:]]*Voucher code:[[:space:]]*[A-Z0-9_-]+',
    '',
    'g'
  ))
WHERE "discount_details" ~* 'Voucher code:[[:space:]]*[A-Z0-9_-]+';

UPDATE "affiliate_offers"
SET
  "voucher_code" = (regexp_match(
    "description",
    '^([A-Z0-9_-]{5,})[[:space:]]+[–—-][[:space:]]+'
  ))[1],
  "description" = regexp_replace(
    "description",
    '^[A-Z0-9_-]{5,}[[:space:]]+[–—-][[:space:]]+',
    ''
  )
WHERE "voucher_code" IS NULL
  AND "description" ~ '^[A-Z0-9_-]{5,}[[:space:]]+[–—-][[:space:]]+';
