CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("event_id")
);