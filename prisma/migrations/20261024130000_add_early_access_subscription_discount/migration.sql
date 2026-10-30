ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "early_access_discount_eligible" BOOLEAN NOT NULL DEFAULT false;
