-- Adds owner links, invitation records, and subscription seat metadata for agency teams.
ALTER TABLE "agencies"
ADD COLUMN "owner_user_id" UUID;

WITH agency_owners AS (
  SELECT agency_id, user_id
  FROM (
    SELECT user_agency."agency_id" AS agency_id, user_agency."user_id" AS user_id,
      ROW_NUMBER() OVER (PARTITION BY user_agency."user_id" ORDER BY user_agency."created_at", user_agency."agency_id") AS owner_rank
    FROM "user_agency" AS user_agency
  ) AS ranked_agency_owners
  WHERE owner_rank = 1
)
UPDATE "agencies" AS agency
SET "owner_user_id" = agency_owners.user_id
FROM agency_owners
WHERE agency."agency_id" = agency_owners.agency_id
  AND agency."owner_user_id" IS NULL;

CREATE UNIQUE INDEX "agencies_owner_user_id_key" ON "agencies"("owner_user_id");

ALTER TABLE "agencies"
ADD CONSTRAINT "agencies_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agency_invitations" (
  "agency_invitation_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agency_invitations_pkey" PRIMARY KEY ("agency_invitation_id")
);

CREATE UNIQUE INDEX "agency_invitations_token_hash_key" ON "agency_invitations"("token_hash");
CREATE INDEX "agency_invitations_agency_id_email_accepted_at_idx"
ON "agency_invitations"("agency_id", "email", "accepted_at");

ALTER TABLE "agency_invitations"
ADD CONSTRAINT "agency_invitations_agency_id_fkey"
FOREIGN KEY ("agency_id") REFERENCES "agencies"("agency_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_subscriptions"
ADD COLUMN "plan_id" TEXT,
ADD COLUMN "seat_limit" INTEGER NOT NULL DEFAULT 0;
