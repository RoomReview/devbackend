ALTER TABLE "users"
ADD COLUMN "rewards_unlocked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" AS user_record
SET "rewards_unlocked" = true
WHERE EXISTS (
  SELECT 1
  FROM "reviews"
  WHERE "reviews"."author_id" = user_record."user_id"
    AND "reviews"."status" = 'APPROVED'
)
OR EXISTS (
  SELECT 1
  FROM "review_reward_grants"
  WHERE "review_reward_grants"."user_id" = user_record."user_id"
);
