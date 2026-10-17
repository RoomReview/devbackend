CREATE TABLE "sso_login_codes" (
    "code_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_login_codes_pkey" PRIMARY KEY ("code_hash"),
    CONSTRAINT "sso_login_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "sso_login_codes_expires_at_idx" ON "sso_login_codes"("expires_at");

UPDATE "analytics_events"
SET
    "path" = regexp_replace("path", '([?&](accessToken|refreshToken|access_token|refresh_token|idToken|id_token|token|code|authorization|clientSecret|client_secret)=)[^&]*', '\1[REDACTED]', 'gi'),
    "referrer" = regexp_replace("referrer", '([?&](accessToken|refreshToken|access_token|refresh_token|idToken|id_token|token|code|authorization|clientSecret|client_secret)=)[^&]*', '\1[REDACTED]', 'gi')
WHERE
    "path" ~* '[?&](accessToken|refreshToken|access_token|refresh_token|idToken|id_token|token|code|authorization|clientSecret|client_secret)='
    OR "referrer" ~* '[?&](accessToken|refreshToken|access_token|refresh_token|idToken|id_token|token|code|authorization|clientSecret|client_secret)=';
