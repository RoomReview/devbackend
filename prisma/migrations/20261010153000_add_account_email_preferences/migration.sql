ALTER TABLE "users"
ADD COLUMN "email_on_review_approved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_on_review_rejected" BOOLEAN NOT NULL DEFAULT true;
