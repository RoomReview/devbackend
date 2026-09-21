-- CreateTable
CREATE TABLE "analytics_events" (
    "event_id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "anonymous_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "analytics_events_anonymous_id_idx" ON "analytics_events"("anonymous_id");

-- CreateIndex
CREATE INDEX "analytics_events_event_name_created_at_idx" ON "analytics_events"("event_name", "created_at");
