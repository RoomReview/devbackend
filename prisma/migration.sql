-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT', 'LANDLORD', 'ADMIN', 'AGENCY', 'AGENT');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('FLAT', 'HOUSE', 'ROOM', 'STUDIO', 'MAISONETTE', 'BUNGALOW');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('FOR_RENT', 'FOR_SALE');

-- CreateEnum
CREATE TYPE "PriceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "FurnishedType" AS ENUM ('FURNISHED', 'UNFURNISHED', 'PART_FURNISHED');

-- CreateEnum
CREATE TYPE "BillsIncluded" AS ENUM ('INCLUDED', 'EXCLUDED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'PENDING', 'SOLD', 'LET', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ExperienceType" AS ENUM ('POSITIVE', 'NEGATIVE', 'WARNING', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "ExperienceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FEATURED');

-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'STANDARD', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'SUBSCRIPTION', 'DOWNLOAD', 'AI_SUMMARY', 'VALUATION', 'REFUND', 'BONUS');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('BASE', 'EXTENDED', 'ADVANCED', 'FULL_SINGLE', 'FULL_DOUBLE', 'VALUATION', 'AI_SUMMARY');

-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('NEW_BUILD', 'EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_WORK', 'RENOVATION_REQUIRED');

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
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

-- CreateTable
CREATE TABLE "boroughs" (
    "borough_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boroughs_pkey" PRIMARY KEY ("borough_id")
);

-- CreateTable
CREATE TABLE "postcodes" (
    "postcode_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "outcode" TEXT NOT NULL,
    "incode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "borough_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postcodes_pkey" PRIMARY KEY ("postcode_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "safety_rating" SMALLINT NOT NULL,
    "transport_rating" SMALLINT NOT NULL,
    "amenities_rating" SMALLINT NOT NULL,
    "value_rating" SMALLINT NOT NULL,
    "overall_rating" DOUBLE PRECISION NOT NULL,
    "pros" TEXT[],
    "cons" TEXT[],
    "years_lived" INTEGER,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "author_id" UUID NOT NULL,
    "postcode_id" TEXT,
    "borough_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "properties" (
    "property_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "listing_type" "ListingType" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "price_frequency" "PriceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "bedrooms" SMALLINT NOT NULL,
    "bathrooms" SMALLINT NOT NULL,
    "size" INTEGER,
    "furnished" "FurnishedType" NOT NULL DEFAULT 'UNFURNISHED',
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "features" TEXT[],
    "available_from" TIMESTAMP(3),
    "min_tenancy" TEXT,
    "deposit" DECIMAL(12,2),
    "bills" "BillsIncluded" NOT NULL DEFAULT 'EXCLUDED',
    "epc_rating" TEXT,
    "floor_plan" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "landlord_id" UUID NOT NULL,
    "postcode_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("property_id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "property_image_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "property_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("property_image_id")
);

-- CreateTable
CREATE TABLE "saved_properties" (
    "saved_property_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_properties_pkey" PRIMARY KEY ("saved_property_id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "experience_id" UUID NOT NULL,
    "type" "ExperienceType" NOT NULL,
    "title" TEXT NOT NULL,
    "story" TEXT NOT NULL,
    "landlord_name" TEXT,
    "agent_name" TEXT,
    "year_of_experience" INTEGER,
    "anonymous" BOOLEAN NOT NULL DEFAULT true,
    "contact_email" TEXT,
    "status" "ExperienceStatus" NOT NULL DEFAULT 'PENDING',
    "admin_notes" TEXT,
    "author_id" UUID,
    "postcode_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("experience_id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "blog_post_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "featured_image" TEXT,
    "read_time" INTEGER,
    "status" "BlogStatus" NOT NULL DEFAULT 'DRAFT',
    "category_id" UUID,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("blog_post_id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "blog_category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("blog_category_id")
);

-- CreateTable
CREATE TABLE "blog_tags" (
    "blog_tag_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("blog_tag_id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "newsletter_subscriber_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirm_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("newsletter_subscriber_id")
);

-- CreateTable
CREATE TABLE "contact_inquiries" (
    "contact_inquiry_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_inquiries_pkey" PRIMARY KEY ("contact_inquiry_id")
);

-- CreateTable
CREATE TABLE "rent_data" (
    "rent_data_id" UUID NOT NULL,
    "postcode" TEXT NOT NULL,
    "property_type" TEXT NOT NULL,
    "rent" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rent_data_pkey" PRIMARY KEY ("rent_data_id")
);

-- CreateTable
CREATE TABLE "property_value_data" (
    "property_value_data_id" UUID NOT NULL,
    "postcode" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_value_data_pkey" PRIMARY KEY ("property_value_data_id")
);

-- CreateTable
CREATE TABLE "demography" (
    "demography_id" UUID NOT NULL,
    "postcode" TEXT NOT NULL,
    "age_group" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demography_pkey" PRIMARY KEY ("demography_id")
);

-- CreateTable
CREATE TABLE "crime_data" (
    "crime_data_id" UUID NOT NULL,
    "borough" TEXT NOT NULL,
    "crime_type" TEXT,
    "crime_rate" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crime_data_pkey" PRIMARY KEY ("crime_data_id")
);

-- CreateTable
CREATE TABLE "voting_data" (
    "voting_data_id" UUID NOT NULL,
    "borough" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "party" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voting_data_pkey" PRIMARY KEY ("voting_data_id")
);

-- CreateTable
CREATE TABLE "local_plans" (
    "local_plan_id" UUID NOT NULL,
    "borough" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "indicator" TEXT,
    "forecast_change" TEXT,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_plans_pkey" PRIMARY KEY ("local_plan_id")
);

-- CreateTable
CREATE TABLE "user_credits" (
    "user_credits_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credits_balance" INTEGER NOT NULL DEFAULT 15,
    "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "ai_summary_used" INTEGER NOT NULL DEFAULT 0,
    "ai_summary_limit" INTEGER NOT NULL DEFAULT 0,
    "plan_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_credits_pkey" PRIMARY KEY ("user_credits_id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "credit_transaction_id" UUID NOT NULL,
    "user_credits_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("credit_transaction_id")
);

-- CreateTable
CREATE TABLE "download_history" (
    "download_history_id" UUID NOT NULL,
    "user_credits_id" UUID NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "format" TEXT NOT NULL,
    "postcode" TEXT,
    "borough" TEXT,
    "credits_used" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "download_history_pkey" PRIMARY KEY ("download_history_id")
);

-- CreateTable
CREATE TABLE "property_valuations" (
    "property_valuation_id" UUID NOT NULL,
    "user_credits_id" UUID NOT NULL,
    "postcode" TEXT NOT NULL,
    "property_type" TEXT NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "floor_area" INTEGER,
    "year_built" INTEGER,
    "condition" "PropertyCondition" NOT NULL DEFAULT 'AVERAGE',
    "current_valuation" DECIMAL(12,2),
    "forecast_valuation" DECIMAL(12,2),
    "forecast_date" TIMESTAMP(3),
    "ai_summary" TEXT,
    "credits_used" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_valuations_pkey" PRIMARY KEY ("property_valuation_id")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "ai_interaction_id" UUID NOT NULL,
    "user_credits_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "postcode" TEXT,
    "borough" TEXT,
    "tokens_used" INTEGER,
    "credits_used" INTEGER NOT NULL,
    "downloaded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("ai_interaction_id")
);

-- CreateTable
CREATE TABLE "_BlogPostToBlogTag" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BlogPostToBlogTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_facebook_id_key" ON "users"("facebook_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_user_id_key" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_email_key" ON "agencies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_agency_user_id_agency_id_key" ON "user_agency"("user_id", "agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "boroughs_name_key" ON "boroughs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "boroughs_slug_key" ON "boroughs"("slug");

-- CreateIndex
CREATE INDEX "boroughs_slug_idx" ON "boroughs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "postcodes_code_key" ON "postcodes"("code");

-- CreateIndex
CREATE INDEX "postcodes_code_idx" ON "postcodes"("code");

-- CreateIndex
CREATE INDEX "postcodes_outcode_idx" ON "postcodes"("outcode");

-- CreateIndex
CREATE INDEX "postcodes_borough_id_idx" ON "postcodes"("borough_id");

-- CreateIndex
CREATE INDEX "reviews_postcode_id_idx" ON "reviews"("postcode_id");

-- CreateIndex
CREATE INDEX "reviews_borough_id_idx" ON "reviews"("borough_id");

-- CreateIndex
CREATE INDEX "reviews_author_id_idx" ON "reviews"("author_id");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at");

-- CreateIndex
CREATE INDEX "properties_postcode_id_idx" ON "properties"("postcode_id");

-- CreateIndex
CREATE INDEX "properties_landlord_id_idx" ON "properties"("landlord_id");

-- CreateIndex
CREATE INDEX "properties_listing_type_idx" ON "properties"("listing_type");

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "properties_bedrooms_idx" ON "properties"("bedrooms");

-- CreateIndex
CREATE INDEX "property_images_property_id_idx" ON "property_images"("property_id");

-- CreateIndex
CREATE INDEX "saved_properties_user_id_idx" ON "saved_properties"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_properties_user_id_property_id_key" ON "saved_properties"("user_id", "property_id");

-- CreateIndex
CREATE INDEX "experiences_status_idx" ON "experiences"("status");

-- CreateIndex
CREATE INDEX "experiences_postcode_id_idx" ON "experiences"("postcode_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_idx" ON "blog_posts"("status");

-- CreateIndex
CREATE INDEX "blog_posts_category_id_idx" ON "blog_posts"("category_id");

-- CreateIndex
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE INDEX "blog_categories_slug_idx" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_tags_name_key" ON "blog_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_tags_slug_key" ON "blog_tags"("slug");

-- CreateIndex
CREATE INDEX "blog_tags_slug_idx" ON "blog_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE INDEX "contact_inquiries_status_idx" ON "contact_inquiries"("status");

-- CreateIndex
CREATE INDEX "contact_inquiries_created_at_idx" ON "contact_inquiries"("created_at");

-- CreateIndex
CREATE INDEX "rent_data_postcode_idx" ON "rent_data"("postcode");

-- CreateIndex
CREATE INDEX "rent_data_date_idx" ON "rent_data"("date");

-- CreateIndex
CREATE INDEX "rent_data_property_type_idx" ON "rent_data"("property_type");

-- CreateIndex
CREATE INDEX "property_value_data_postcode_idx" ON "property_value_data"("postcode");

-- CreateIndex
CREATE INDEX "property_value_data_date_idx" ON "property_value_data"("date");

-- CreateIndex
CREATE INDEX "demography_postcode_idx" ON "demography"("postcode");

-- CreateIndex
CREATE INDEX "demography_date_idx" ON "demography"("date");

-- CreateIndex
CREATE INDEX "crime_data_borough_idx" ON "crime_data"("borough");

-- CreateIndex
CREATE INDEX "crime_data_date_idx" ON "crime_data"("date");

-- CreateIndex
CREATE INDEX "voting_data_borough_idx" ON "voting_data"("borough");

-- CreateIndex
CREATE INDEX "voting_data_year_idx" ON "voting_data"("year");

-- CreateIndex
CREATE INDEX "local_plans_borough_idx" ON "local_plans"("borough");

-- CreateIndex
CREATE INDEX "local_plans_category_idx" ON "local_plans"("category");

-- CreateIndex
CREATE UNIQUE INDEX "user_credits_user_id_key" ON "user_credits"("user_id");

-- CreateIndex
CREATE INDEX "credit_transactions_user_credits_id_idx" ON "credit_transactions"("user_credits_id");

-- CreateIndex
CREATE INDEX "credit_transactions_created_at_idx" ON "credit_transactions"("created_at");

-- CreateIndex
CREATE INDEX "download_history_user_credits_id_idx" ON "download_history"("user_credits_id");

-- CreateIndex
CREATE INDEX "download_history_created_at_idx" ON "download_history"("created_at");

-- CreateIndex
CREATE INDEX "property_valuations_user_credits_id_idx" ON "property_valuations"("user_credits_id");

-- CreateIndex
CREATE INDEX "property_valuations_postcode_idx" ON "property_valuations"("postcode");

-- CreateIndex
CREATE INDEX "property_valuations_created_at_idx" ON "property_valuations"("created_at");

-- CreateIndex
CREATE INDEX "ai_interactions_user_credits_id_idx" ON "ai_interactions"("user_credits_id");

-- CreateIndex
CREATE INDEX "ai_interactions_created_at_idx" ON "ai_interactions"("created_at");

-- CreateIndex
CREATE INDEX "_BlogPostToBlogTag_B_index" ON "_BlogPostToBlogTag"("B");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_agency" ADD CONSTRAINT "user_agency_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_agency" ADD CONSTRAINT "user_agency_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("agency_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postcodes" ADD CONSTRAINT "postcodes_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("borough_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_postcode_id_fkey" FOREIGN KEY ("postcode_id") REFERENCES "postcodes"("postcode_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("borough_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_postcode_id_fkey" FOREIGN KEY ("postcode_id") REFERENCES "postcodes"("postcode_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_postcode_id_fkey" FOREIGN KEY ("postcode_id") REFERENCES "postcodes"("postcode_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("blog_category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_credits_id_fkey" FOREIGN KEY ("user_credits_id") REFERENCES "user_credits"("user_credits_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_history" ADD CONSTRAINT "download_history_user_credits_id_fkey" FOREIGN KEY ("user_credits_id") REFERENCES "user_credits"("user_credits_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_user_credits_id_fkey" FOREIGN KEY ("user_credits_id") REFERENCES "user_credits"("user_credits_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_user_credits_id_fkey" FOREIGN KEY ("user_credits_id") REFERENCES "user_credits"("user_credits_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlogPostToBlogTag" ADD CONSTRAINT "_BlogPostToBlogTag_A_fkey" FOREIGN KEY ("A") REFERENCES "blog_posts"("blog_post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlogPostToBlogTag" ADD CONSTRAINT "_BlogPostToBlogTag_B_fkey" FOREIGN KEY ("B") REFERENCES "blog_tags"("blog_tag_id") ON DELETE CASCADE ON UPDATE CASCADE;
