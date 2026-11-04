ALTER TABLE "reviews"
ADD COLUMN "author_first_name" TEXT,
ADD COLUMN "author_last_name" TEXT;

UPDATE "reviews" AS review
SET "author_first_name" = "users"."first_name",
    "author_last_name" = "users"."last_name"
FROM "users"
WHERE "users"."user_id" = review."author_id";

ALTER TABLE "reviews"
ALTER COLUMN "author_first_name" SET NOT NULL,
ALTER COLUMN "author_last_name" SET NOT NULL;
