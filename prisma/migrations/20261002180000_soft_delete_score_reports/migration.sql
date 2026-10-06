ALTER TABLE "score_reports"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);