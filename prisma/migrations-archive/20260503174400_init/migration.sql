-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT', 'LANDLORD', 'ADMIN', 'AGENCY', 'AGENT');

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "role" "UserRole" NOT NULL DEFAULT 'TENANT',
    "verify_code_hash" TEXT,
    "verified_at" TIMESTAMP(3),
    "verify_code_expiry" TIMESTAMP(3),
    "google_id" TEXT,
    "facebook_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "session_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token_id" UUID,
    "access_token_expiry" TIMESTAMP(3),
    "refresh_token_id" UUID,
    "refresh_token_expiry" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "user_agency" (
    "user_agency_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_agency_pkey" PRIMARY KEY ("user_agency_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_facebook_id_key" ON "users"("facebook_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_user_id_key" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_email_key" ON "agencies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_agency_user_id_agency_id_key" ON "user_agency"("user_id", "agency_id");

-- AddForeignKey
ALTER TABLE "user_agency" ADD CONSTRAINT "user_agency_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_agency" ADD CONSTRAINT "user_agency_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("agency_id") ON DELETE CASCADE ON UPDATE CASCADE;
