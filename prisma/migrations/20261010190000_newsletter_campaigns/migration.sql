ALTER TABLE "newsletter_subscribers"
ADD COLUMN "unsubscribe_token" TEXT;

CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_key"
ON "newsletter_subscribers"("unsubscribe_token");

CREATE TABLE "newsletter_article_deliveries" (
    "article_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "newsletter_article_deliveries_pkey" PRIMARY KEY ("article_id")
);
