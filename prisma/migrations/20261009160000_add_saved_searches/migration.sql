CREATE TABLE "saved_searches" (
    "saved_search_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "postcode" VARCHAR(8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("saved_search_id")
);

CREATE UNIQUE INDEX "saved_searches_user_id_postcode_key"
ON "saved_searches"("user_id", "postcode");

CREATE INDEX "saved_searches_user_id_created_at_idx"
ON "saved_searches"("user_id", "created_at");

ALTER TABLE "saved_searches"
ADD CONSTRAINT "saved_searches_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;
