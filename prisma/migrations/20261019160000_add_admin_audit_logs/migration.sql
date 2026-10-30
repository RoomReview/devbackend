CREATE TABLE "admin_audit_logs" (
    "audit_log_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("audit_log_id")
);

CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");
CREATE INDEX "admin_audit_logs_actor_user_id_created_at_idx" ON "admin_audit_logs"("actor_user_id", "created_at");
