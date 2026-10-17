DROP TABLE "newsletter_article_deliveries";

DROP INDEX "newsletter_subscribers_unsubscribe_token_key";

ALTER TABLE "newsletter_subscribers"
DROP COLUMN "unsubscribe_token";
