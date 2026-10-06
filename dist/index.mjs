import { createRequire } from "node:module";
import cors from "cors";
import dotenv from "dotenv";
import express, { Router } from "express";
import helmet from "helmet";
import morgan from "morgan";
import crypto$1, { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PrismaPg } from "@prisma/adapter-pg";
import * as path from "node:path";
import { fileURLToPath as fileURLToPath$1 } from "node:url";
import * as runtime from "@prisma/client/runtime/client";
import jwt from "jsonwebtoken";
import sgMail from "@sendgrid/mail";
import { ZodError, any, email, enum as enum$1, nativeEnum, number, object, preprocess, record, regexes, string, unknown, uuid, z } from "zod";
import passport from "passport";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Strategy } from "passport-google-oauth20";
import { Strategy as Strategy$1 } from "passport-facebook";

//#region src/utils/custom-error.ts
const ErrorCodes = {
	ENTITY_NOT_FOUND: "ENTITY_NOT_FOUND",
	INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
	ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
	VALIDATION_ERROR: "VALIDATION_ERROR",
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN"
};
var CustomError = class extends Error {
	message;
	statusCode;
	code;
	data;
	constructor({ message, statusCode, code, data }) {
		super();
		this.message = message;
		this.statusCode = statusCode;
		this.code = code;
		this.data = data;
	}
};
var EntityNotFoundError = class extends CustomError {
	statusCode = 404;
};
var InternalServerError = class extends CustomError {
	statusCode = 500;
};
var RouteNotFoundError = class extends CustomError {
	statusCode = 404;
};
var ValidationError = class extends CustomError {
	statusCode = 400;
};
var UnauthorizedError = class extends CustomError {
	statusCode = 401;
	constructor({ message, statusCode, code, data }) {
		super({
			message,
			statusCode,
			code: code ?? "UNAUTHORIZED",
			data
		});
		this.statusCode = statusCode ?? 401;
	}
};

//#endregion
//#region src/utils/logger.ts
const LogLevel = {
	INFO: "INFO",
	WARN: "WARN",
	ERROR: "ERROR",
	DEBUG: "DEBUG"
};
const getCurrentLogLevel = () => {
	const envLevel = process.env.LOG_LEVEL?.toUpperCase();
	return Object.values(LogLevel).includes(envLevel) ? envLevel : LogLevel.INFO;
};
const shouldLog = (level) => {
	const levels = {
		[LogLevel.DEBUG]: 0,
		[LogLevel.INFO]: 1,
		[LogLevel.WARN]: 2,
		[LogLevel.ERROR]: 3
	};
	return levels[level] >= levels[getCurrentLogLevel()];
};
const serializeData = (data) => {
	if (data instanceof Error) return {
		name: data.name,
		message: data.message,
		stack: data.stack
	};
	if (Array.isArray(data)) return data.map(serializeData);
	if (data && typeof data === "object") return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeData(value)]));
	return data;
};
const formatLog = (level, message, context, data) => {
	return JSON.stringify({
		type: "application_log",
		timestamp: (/* @__PURE__ */ new Date()).toISOString(),
		level,
		service: context?.service,
		function: context?.function,
		message,
		...data === void 0 ? {} : { data: serializeData(data) }
	});
};
const logger = {
	info: (context, message, data) => {
		if (shouldLog(LogLevel.INFO)) console.log(formatLog(LogLevel.INFO, message, context, data), data);
	},
	warn: (context, message, data) => {
		if (shouldLog(LogLevel.WARN)) console.warn(formatLog(LogLevel.WARN, message, context, data), data);
	},
	error: (context, message, data) => {
		if (shouldLog(LogLevel.ERROR)) console.error(formatLog(LogLevel.ERROR, message, context, data), data);
	},
	debug: (context, message, data) => {
		if (shouldLog(LogLevel.DEBUG)) console.debug(formatLog(LogLevel.DEBUG, message, context, data), data);
	}
};

//#endregion
//#region src/middleware/error.middleware.ts
const errorHandler = (err, req, res, next) => {
	if (res.headersSent) {
		next(err);
		return;
	}
	logger.error({
		service: "HTTP",
		function: "errorHandler"
	}, `${err.statusCode ?? 500} ${err.message}`, {
		requestId: req.id ?? "-",
		method: req.method,
		url: req.originalUrl,
		code: err.code,
		error: err
	});
	const responseObj = {
		success: false,
		message: err.message,
		data: err?.data ?? void 0,
		error: process.env.NODE_ENV === "development" && err?.stack || void 0,
		statusCode: err.statusCode ?? 500,
		status: err.status ?? "error"
	};
	if (err instanceof CustomError) {
		responseObj.error = err?.code;
		res.status(responseObj.statusCode).json(responseObj);
		return;
	}
	res.status(500).json(responseObj);
};
const notFoundHandler = (req, _res, next) => {
	if (!req.route) next(new RouteNotFoundError({
		message: `Route not found: ${req.method} ${req.originalUrl}`,
		statusCode: 404,
		code: "ROUTE_NOT_FOUND"
	}));
	else next();
};

//#endregion
//#region src/middleware/request-id.middleware.ts
const defaultGenerator = (_req) => {
	return randomUUID();
};
const assignRequestId = ({ generator = defaultGenerator, headerName = "X-Request-ID", setHeader = true } = {}) => {
	return function(req, res, next) {
		const requestId = req.header(headerName) ?? generator(req);
		req["id"] = requestId;
		if (setHeader) res.setHeader(headerName, requestId);
		next();
	};
};

//#endregion
//#region src/middleware/request-logger.middleware.ts
const getCustomMorganFormat = (tokens, req, res) => {
	const logParts = {
		requestId: req.id ?? "-",
		remoteAddr: tokens["remote-addr"]?.(req, res) ?? "-",
		remoteUser: tokens["remote-user"]?.(req, res) ?? "-",
		timestamp: tokens["date"]?.(req, res, "iso") ?? "-",
		method: tokens["method"]?.(req, res) ?? "-",
		url: tokens["url"]?.(req, res) ?? "-",
		httpVersion: tokens["http-version"]?.(req, res) ?? "-",
		statusCode: tokens["status"]?.(req, res) ?? "-",
		responseTime: `${tokens["response-time"]?.(req, res) ?? "-"} ms`,
		contentLength: tokens["res"]?.(req, res, "content-length") ?? "-",
		referrer: tokens["referrer"]?.(req, res) ?? "-",
		userAgent: tokens["user-agent"]?.(req, res) ?? "-"
	};
	return JSON.stringify({
		type: "http_request",
		...logParts
	});
};

//#endregion
//#region src/generated/prisma/enums.ts
const UserRole = {
	TENANT: "TENANT",
	LANDLORD: "LANDLORD",
	ADMIN: "ADMIN",
	AGENCY: "AGENCY",
	AGENT: "AGENT"
};

//#endregion
//#region src/config/permissions.ts
const permissions = {
	"view:users:all": [UserRole.ADMIN],
	"manage:users": [UserRole.ADMIN],
	"view:users:self": [
		UserRole.ADMIN,
		UserRole.LANDLORD,
		UserRole.TENANT
	],
	"manage:locations": [UserRole.ADMIN],
	"manage:reports": [UserRole.ADMIN]
};

//#endregion
//#region src/generated/prisma/internal/class.ts
const config$1 = {
	"previewFeatures": [],
	"clientVersion": "7.7.0",
	"engineVersion": "75cbdc1eb7150937890ad5465d861175c6624711",
	"activeProvider": "postgresql",
	"inlineSchema": "generator client {\n  provider = \"prisma-client\"\n  output   = \"../src/generated/prisma\"\n}\n\ndatasource db {\n  provider = \"postgresql\"\n}\n\nmodel User {\n  userId              String               @id @default(uuid(7)) @map(\"user_id\") @db.Uuid\n  email               String               @unique\n  firstName           String               @map(\"first_name\")\n  lastName            String               @map(\"last_name\")\n  phone               String?\n  avatar              String?\n  bio                 String?\n  passwordHash        String?              @map(\"password_hash\")\n  isEmailVerified     Boolean              @default(false) @map(\"is_email_verified\")\n  isActive            Boolean              @default(true) @map(\"is_active\")\n  role                UserRole             @default(TENANT)\n  verifyCodeHash      String?              @map(\"verify_code_hash\")\n  verifiedAt          DateTime?            @map(\"verified_at\")\n  verifyCodeExpiry    DateTime?            @map(\"verify_code_expiry\")\n  googleId            String?              @unique @map(\"google_id\")\n  facebookId          String?              @unique @map(\"facebook_id\")\n  createdAt           DateTime             @default(now()) @map(\"created_at\")\n  updatedAt           DateTime             @updatedAt @map(\"updated_at\")\n  experiences         experiences[]\n  properties          properties[]\n  reviews             reviews[]\n  saved_properties    saved_properties[]\n  sessions            Session?\n  agencies            UserAgency[]\n  user_credits        user_credits?\n  scoreReports        ScoreReport[]\n  reportOrders        ReportOrder[]\n  billingSubscription BillingSubscription?\n  trialStartedAt      DateTime?            @map(\"trial_started_at\")\n  trialEndsAt         DateTime?            @map(\"trial_ends_at\")\n\n  @@index([email])\n  @@index([role])\n  @@map(\"users\")\n}\n\nmodel AnalyticsEvent {\n  eventId     String   @id @default(uuid(7)) @map(\"event_id\") @db.Uuid\n  eventName   String   @map(\"event_name\")\n  anonymousId String   @map(\"anonymous_id\") @db.Uuid\n  path        String\n  referrer    String?\n  createdAt   DateTime @default(now()) @map(\"created_at\")\n\n  @@index([anonymousId])\n  @@index([eventName, createdAt])\n  @@map(\"analytics_events\")\n}\n\nmodel Session {\n  sessionId          Int       @id @default(autoincrement()) @map(\"session_id\")\n  userId             String    @unique @map(\"user_id\") @db.Uuid\n  accessTokenId      String?   @map(\"access_token_id\") @db.Uuid\n  accessTokenExpiry  DateTime? @map(\"access_token_expiry\")\n  refreshTokenId     String?   @map(\"refresh_token_id\") @db.Uuid\n  refreshTokenExpiry DateTime? @map(\"refresh_token_expiry\")\n  createdAt          DateTime  @default(now()) @map(\"created_at\")\n  updatedAt          DateTime  @updatedAt @map(\"updated_at\")\n  users              User      @relation(fields: [userId], references: [userId], onDelete: Cascade)\n\n  @@map(\"sessions\")\n}\n\nmodel Agency {\n  agencyId    String       @id @default(uuid(7)) @map(\"agency_id\") @db.Uuid\n  name        String\n  description String?\n  email       String?      @unique\n  phone       String?\n  website     String?\n  isVerified  Boolean      @default(false) @map(\"is_verified\")\n  createdAt   DateTime     @default(now()) @map(\"created_at\")\n  updatedAt   DateTime     @updatedAt @map(\"updated_at\")\n  users       UserAgency[]\n\n  @@map(\"agencies\")\n}\n\nmodel UserAgency {\n  userAgencyId String   @id @default(uuid(7)) @map(\"user_agency_id\") @db.Uuid\n  userId       String   @map(\"user_id\") @db.Uuid\n  agencyId     String   @map(\"agency_id\") @db.Uuid\n  isVerified   Boolean  @default(false) @map(\"is_verified\")\n  createdAt    DateTime @default(now()) @map(\"created_at\")\n  updatedAt    DateTime @updatedAt @map(\"updated_at\")\n  agency       Agency   @relation(fields: [agencyId], references: [agencyId], onDelete: Cascade)\n  user         User     @relation(fields: [userId], references: [userId], onDelete: Cascade)\n\n  @@unique([userId, agencyId])\n  @@map(\"user_agency\")\n}\n\nmodel Borough {\n  boroughId    String        @id @default(uuid(7)) @map(\"borough_id\")\n  name         String        @unique\n  slug         String        @unique\n  description  String?\n  image        String?\n  latitude     Float?\n  longitude    Float?\n  metrics      Json          @default(\"{}\")\n  createdAt    DateTime      @default(now()) @map(\"created_at\")\n  updatedAt    DateTime      @updatedAt @map(\"updated_at\")\n  postcodes    Postcode[]\n  scoreReports ScoreReport[]\n  reviews      reviews[]\n\n  @@index([slug])\n  @@map(\"boroughs\")\n}\n\nmodel Postcode {\n  postcodeId   String        @id @default(uuid(7)) @map(\"postcode_id\")\n  code         String        @unique\n  outcode      String\n  incode       String\n  latitude     Float?\n  longitude    Float?\n  imageUrl     String?       @map(\"image_url\")\n  metrics      Json          @default(\"{}\")\n  boroughId    String?       @map(\"borough_id\")\n  createdAt    DateTime      @default(now()) @map(\"created_at\")\n  updatedAt    DateTime      @updatedAt @map(\"updated_at\")\n  experiences  experiences[]\n  borough      Borough?      @relation(fields: [boroughId], references: [boroughId])\n  properties   properties[]\n  reviews      reviews[]\n  scoreReports ScoreReport[]\n\n  @@index([boroughId])\n  @@index([code])\n  @@index([outcode])\n  @@map(\"postcodes\")\n}\n\nenum ScoreStatus {\n  WAITING\n  GENERATING\n  READY\n  FAILED\n}\n\nmodel ScoreReport {\n  scoreReportId  String      @id @default(uuid(7)) @map(\"score_report_id\")\n  userId         String?     @map(\"user_id\") @db.Uuid\n  boroughId      String?     @map(\"borough_id\")\n  postcodeId     String?     @map(\"postcode_id\")\n  name           String?\n  description    String?\n  status         ScoreStatus @default(WAITING)\n  overallScore   Float?\n  boroughScore   Float?\n  postcodeScore  Float?\n  scoreBreakdown Json?\n  reportData     Json?\n  failureReason  String?\n  deletedAt      DateTime?   @map(\"deleted_at\")\n  createdAt      DateTime    @default(now()) @map(\"created_at\")\n  updatedAt      DateTime    @updatedAt @map(\"updated_at\")\n\n  borough      Borough?      @relation(fields: [boroughId], references: [boroughId])\n  postcode     Postcode?     @relation(fields: [postcodeId], references: [postcodeId])\n  user         User?         @relation(fields: [userId], references: [userId], onDelete: SetNull)\n  reportOrders ReportOrder[]\n\n  @@map(\"score_reports\")\n}\n\nenum OrderStatus {\n  PENDING\n  PAID\n  FAILED\n  CANCELLED\n}\n\nmodel ReportOrder {\n  orderId             String      @id @default(uuid(7)) @map(\"order_id\") @db.Uuid\n  userId              String      @map(\"user_id\") @db.Uuid\n  scoreReportId       String      @map(\"score_report_id\")\n  stripeSessionId     String?     @unique @map(\"stripe_session_id\")\n  stripePaymentIntent String?     @map(\"stripe_payment_intent\")\n  amount              Int\n  currency            String\n  status              OrderStatus @default(PENDING)\n  paidAt              DateTime?   @map(\"paid_at\")\n  createdAt           DateTime    @default(now()) @map(\"created_at\")\n  updatedAt           DateTime    @updatedAt @map(\"updated_at\")\n  user                User        @relation(fields: [userId], references: [userId], onDelete: Cascade)\n  scoreReport         ScoreReport @relation(fields: [scoreReportId], references: [scoreReportId], onDelete: Cascade)\n\n  @@index([userId, createdAt])\n  @@index([scoreReportId])\n  @@map(\"report_orders\")\n}\n\nmodel PaymentWebhookEvent {\n  eventId     String   @id @map(\"event_id\")\n  eventType   String   @map(\"event_type\")\n  status      String   @default(\"PROCESSING\")\n  processedAt DateTime @default(now()) @map(\"processed_at\")\n\n  @@map(\"payment_webhook_events\")\n}\n\nenum BillingSubscriptionStatus {\n  INCOMPLETE\n  ACTIVE\n  PAST_DUE\n  CANCELED\n  UNPAID\n}\n\nmodel BillingSubscription {\n  billingSubscriptionId String                    @id @default(uuid(7)) @map(\"billing_subscription_id\") @db.Uuid\n  userId                String                    @unique @map(\"user_id\") @db.Uuid\n  stripeCustomerId      String?                   @map(\"stripe_customer_id\")\n  stripeSubscriptionId  String                    @unique @map(\"stripe_subscription_id\")\n  status                BillingSubscriptionStatus\n  currentPeriodEnd      DateTime?                 @map(\"current_period_end\")\n  cancelAtPeriodEnd     Boolean                   @default(false) @map(\"cancel_at_period_end\")\n  createdAt             DateTime                  @default(now()) @map(\"created_at\")\n  updatedAt             DateTime                  @updatedAt @map(\"updated_at\")\n  user                  User                      @relation(fields: [userId], references: [userId], onDelete: Cascade)\n\n  @@map(\"billing_subscriptions\")\n}\n\nmodel ai_interactions {\n  ai_interaction_id String       @id @db.Uuid\n  user_credits_id   String       @db.Uuid\n  query             String\n  response          String\n  postcode          String?\n  borough           String?\n  tokens_used       Int?\n  credits_used      Int\n  downloaded        Boolean      @default(false)\n  created_at        DateTime     @default(now())\n  updated_at        DateTime\n  user_credits      user_credits @relation(fields: [user_credits_id], references: [user_credits_id], onDelete: Cascade)\n\n  @@index([created_at])\n  @@index([user_credits_id])\n}\n\nmodel blog_categories {\n  blog_category_id String       @id @db.Uuid\n  name             String       @unique\n  slug             String       @unique\n  description      String?\n  created_at       DateTime     @default(now())\n  updated_at       DateTime\n  blog_posts       blog_posts[]\n\n  @@index([slug])\n}\n\nmodel blog_posts {\n  blog_post_id     String           @id @db.Uuid\n  title            String\n  slug             String           @unique\n  excerpt          String\n  content          String\n  featured_image   String?\n  read_time        Int?\n  status           BlogStatus       @default(DRAFT)\n  category_id      String?          @db.Uuid\n  meta_title       String?\n  meta_description String?\n  created_at       DateTime         @default(now())\n  updated_at       DateTime\n  published_at     DateTime?\n  blog_categories  blog_categories? @relation(fields: [category_id], references: [blog_category_id])\n  blog_tags        blog_tags[]      @relation(\"BlogPostToBlogTag\")\n\n  @@index([category_id])\n  @@index([published_at])\n  @@index([slug])\n  @@index([status])\n}\n\nmodel blog_tags {\n  blog_tag_id String       @id @db.Uuid\n  name        String       @unique\n  slug        String       @unique\n  created_at  DateTime     @default(now())\n  updated_at  DateTime\n  blog_posts  blog_posts[] @relation(\"BlogPostToBlogTag\")\n\n  @@index([slug])\n}\n\nmodel contact_inquiries {\n  contact_inquiry_id String        @id @db.Uuid\n  name               String\n  email              String\n  subject            String\n  message            String\n  status             InquiryStatus @default(NEW)\n  admin_notes        String?\n  created_at         DateTime      @default(now())\n  updated_at         DateTime\n\n  @@index([created_at])\n  @@index([status])\n}\n\nmodel credit_transactions {\n  credit_transaction_id String          @id @db.Uuid\n  user_credits_id       String          @db.Uuid\n  amount                Int\n  type                  TransactionType\n  description           String\n  balance_after         Int\n  created_at            DateTime        @default(now())\n  updated_at            DateTime\n  user_credits          user_credits    @relation(fields: [user_credits_id], references: [user_credits_id], onDelete: Cascade)\n\n  @@index([created_at])\n  @@index([user_credits_id])\n}\n\nmodel crime_data {\n  crime_data_id String   @id @db.Uuid\n  borough       String\n  crime_type    String?\n  crime_rate    Decimal  @db.Decimal(10, 2)\n  date          DateTime\n  source        String\n  created_at    DateTime @default(now())\n  updated_at    DateTime\n\n  @@index([borough])\n  @@index([date])\n}\n\nmodel demography {\n  demography_id String   @id @db.Uuid\n  postcode      String\n  age_group     String\n  percentage    Decimal  @db.Decimal(5, 2)\n  date          DateTime\n  source        String\n  created_at    DateTime @default(now())\n  updated_at    DateTime\n\n  @@index([date])\n  @@index([postcode])\n}\n\nmodel download_history {\n  download_history_id String       @id @db.Uuid\n  user_credits_id     String       @db.Uuid\n  report_type         ReportType\n  format              String\n  postcode            String?\n  borough             String?\n  credits_used        Int\n  created_at          DateTime     @default(now())\n  updated_at          DateTime\n  user_credits        user_credits @relation(fields: [user_credits_id], references: [user_credits_id], onDelete: Cascade)\n\n  @@index([created_at])\n  @@index([user_credits_id])\n}\n\nmodel experiences {\n  experience_id      String           @id @db.Uuid\n  type               ExperienceType\n  title              String\n  story              String\n  landlord_name      String?\n  agent_name         String?\n  year_of_experience Int?\n  anonymous          Boolean          @default(true)\n  contact_email      String?\n  status             ExperienceStatus @default(PENDING)\n  admin_notes        String?\n  author_id          String?          @db.Uuid\n  postcode_id        String?\n  created_at         DateTime         @default(now())\n  updated_at         DateTime\n  published_at       DateTime?\n  users              User?            @relation(fields: [author_id], references: [userId])\n  postcodes          Postcode?        @relation(fields: [postcode_id], references: [postcodeId])\n\n  @@index([postcode_id])\n  @@index([status])\n}\n\nmodel local_plans {\n  local_plan_id   String   @id @db.Uuid\n  borough         String\n  category        String\n  summary         String\n  indicator       String?\n  forecast_change String?\n  source          String\n  created_at      DateTime @default(now())\n  updated_at      DateTime\n\n  @@index([borough])\n  @@index([category])\n}\n\nmodel newsletter_subscribers {\n  newsletter_subscriber_id String   @id @db.Uuid\n  email                    String   @unique\n  confirmed                Boolean  @default(false)\n  confirm_token            String?\n  created_at               DateTime @default(now())\n  updated_at               DateTime\n\n  @@index([email])\n}\n\nmodel properties {\n  property_id      String             @id @db.Uuid\n  title            String\n  description      String\n  type             PropertyType\n  listing_type     ListingType\n  price            Decimal            @db.Decimal(12, 2)\n  price_frequency  PriceFrequency     @default(MONTHLY)\n  bedrooms         Int                @db.SmallInt\n  bathrooms        Int                @db.SmallInt\n  size             Int?\n  furnished        FurnishedType      @default(UNFURNISHED)\n  address          String\n  latitude         Float?\n  longitude        Float?\n  features         String[]\n  available_from   DateTime?\n  min_tenancy      String?\n  deposit          Decimal?           @db.Decimal(12, 2)\n  bills            BillsIncluded      @default(EXCLUDED)\n  epc_rating       String?\n  floor_plan       String?\n  verified         Boolean            @default(false)\n  featured         Boolean            @default(false)\n  status           PropertyStatus     @default(ACTIVE)\n  view_count       Int                @default(0)\n  landlord_id      String             @db.Uuid\n  postcode_id      String\n  created_at       DateTime           @default(now())\n  updated_at       DateTime\n  users            User               @relation(fields: [landlord_id], references: [userId], onDelete: Cascade)\n  postcodes        Postcode           @relation(fields: [postcode_id], references: [postcodeId])\n  property_images  property_images[]\n  saved_properties saved_properties[]\n\n  @@index([bedrooms])\n  @@index([landlord_id])\n  @@index([listing_type])\n  @@index([postcode_id])\n  @@index([price])\n  @@index([status])\n  @@index([type])\n}\n\nmodel property_images {\n  property_image_id String     @id @db.Uuid\n  url               String\n  alt               String?\n  order             Int        @default(0)\n  property_id       String     @db.Uuid\n  created_at        DateTime   @default(now())\n  updated_at        DateTime\n  properties        properties @relation(fields: [property_id], references: [property_id], onDelete: Cascade)\n\n  @@index([property_id])\n}\n\nmodel property_valuations {\n  property_valuation_id String            @id @db.Uuid\n  user_credits_id       String            @db.Uuid\n  postcode              String\n  property_type         String\n  bedrooms              Int\n  bathrooms             Int\n  floor_area            Int?\n  year_built            Int?\n  condition             PropertyCondition @default(AVERAGE)\n  current_valuation     Decimal?          @db.Decimal(12, 2)\n  forecast_valuation    Decimal?          @db.Decimal(12, 2)\n  forecast_date         DateTime?\n  ai_summary            String?\n  credits_used          Int\n  created_at            DateTime          @default(now())\n  updated_at            DateTime\n  user_credits          user_credits      @relation(fields: [user_credits_id], references: [user_credits_id], onDelete: Cascade)\n\n  @@index([created_at])\n  @@index([postcode])\n  @@index([user_credits_id])\n}\n\nmodel property_value_data {\n  property_value_data_id String   @id @db.Uuid\n  postcode               String\n  value                  Decimal  @db.Decimal(12, 2)\n  date                   DateTime\n  source                 String\n  created_at             DateTime @default(now())\n  updated_at             DateTime\n\n  @@index([date])\n  @@index([postcode])\n}\n\nmodel rent_data {\n  rent_data_id  String   @id @db.Uuid\n  postcode      String\n  property_type String\n  rent          Decimal  @db.Decimal(12, 2)\n  date          DateTime\n  source        String\n  created_at    DateTime @default(now())\n  updated_at    DateTime\n\n  @@index([date])\n  @@index([postcode])\n  @@index([property_type])\n}\n\nmodel reviews {\n  review_id        String       @id @db.Uuid\n  title            String\n  content          String\n  safety_rating    Int          @db.SmallInt\n  transport_rating Int          @db.SmallInt\n  amenities_rating Int          @db.SmallInt\n  value_rating     Int          @db.SmallInt\n  overall_rating   Float\n  pros             String[]\n  cons             String[]\n  years_lived      Int?\n  anonymous        Boolean      @default(false)\n  verified         Boolean      @default(false)\n  status           ReviewStatus @default(PENDING)\n  rejection_reason String?\n  author_id        String       @db.Uuid\n  postcode_id      String?\n  borough_id       String?\n  created_at       DateTime     @default(now())\n  updated_at       DateTime\n  published_at     DateTime?\n  users            User         @relation(fields: [author_id], references: [userId], onDelete: Cascade)\n  boroughs         Borough?     @relation(fields: [borough_id], references: [boroughId])\n  postcodes        Postcode?    @relation(fields: [postcode_id], references: [postcodeId])\n\n  @@index([author_id])\n  @@index([borough_id])\n  @@index([created_at])\n  @@index([postcode_id])\n  @@index([status])\n}\n\nmodel saved_properties {\n  saved_property_id String     @id @db.Uuid\n  user_id           String     @db.Uuid\n  property_id       String     @db.Uuid\n  created_at        DateTime   @default(now())\n  updated_at        DateTime\n  properties        properties @relation(fields: [property_id], references: [property_id], onDelete: Cascade)\n  users             User       @relation(fields: [user_id], references: [userId], onDelete: Cascade)\n\n  @@unique([user_id, property_id])\n  @@index([user_id])\n}\n\nmodel user_credits {\n  user_credits_id     String                @id @db.Uuid\n  user_id             String                @unique @db.Uuid\n  credits_balance     Int                   @default(15)\n  subscription_plan   SubscriptionPlan      @default(FREE)\n  ai_summary_used     Int                   @default(0)\n  ai_summary_limit    Int                   @default(0)\n  plan_expires_at     DateTime?\n  created_at          DateTime              @default(now())\n  updated_at          DateTime\n  ai_interactions     ai_interactions[]\n  credit_transactions credit_transactions[]\n  download_history    download_history[]\n  property_valuations property_valuations[]\n  users               User                  @relation(fields: [user_id], references: [userId], onDelete: Cascade)\n}\n\nmodel voting_data {\n  voting_data_id String   @id @db.Uuid\n  borough        String\n  year           Int\n  party          String\n  percentage     Decimal  @db.Decimal(5, 2)\n  source         String\n  created_at     DateTime @default(now())\n  updated_at     DateTime\n\n  @@index([borough])\n  @@index([year])\n}\n\nenum UserRole {\n  TENANT\n  LANDLORD\n  ADMIN\n  AGENCY\n  AGENT\n}\n\nenum BillsIncluded {\n  INCLUDED\n  EXCLUDED\n  PARTIAL\n}\n\nenum BlogStatus {\n  DRAFT\n  PUBLISHED\n  ARCHIVED\n}\n\nenum ExperienceStatus {\n  PENDING\n  APPROVED\n  REJECTED\n  FEATURED\n}\n\nenum ExperienceType {\n  POSITIVE\n  NEGATIVE\n  WARNING\n  NEUTRAL\n}\n\nenum FurnishedType {\n  FURNISHED\n  UNFURNISHED\n  PART_FURNISHED\n}\n\nenum InquiryStatus {\n  NEW\n  IN_PROGRESS\n  RESOLVED\n  CLOSED\n}\n\nenum ListingType {\n  FOR_RENT\n  FOR_SALE\n}\n\nenum PriceFrequency {\n  WEEKLY\n  MONTHLY\n  YEARLY\n}\n\nenum PropertyCondition {\n  NEW_BUILD\n  EXCELLENT\n  GOOD\n  AVERAGE\n  NEEDS_WORK\n  RENOVATION_REQUIRED\n}\n\nenum PropertyStatus {\n  ACTIVE\n  PENDING\n  SOLD\n  LET\n  WITHDRAWN\n}\n\nenum PropertyType {\n  FLAT\n  HOUSE\n  ROOM\n  STUDIO\n  MAISONETTE\n  BUNGALOW\n}\n\nenum ReportType {\n  BASE\n  EXTENDED\n  ADVANCED\n  FULL_SINGLE\n  FULL_DOUBLE\n  VALUATION\n  AI_SUMMARY\n}\n\nenum ReviewStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nenum SubscriptionPlan {\n  FREE\n  BASIC\n  STANDARD\n  PRO\n  PREMIUM\n}\n\nenum TransactionType {\n  PURCHASE\n  SUBSCRIPTION\n  DOWNLOAD\n  AI_SUMMARY\n  VALUATION\n  REFUND\n  BONUS\n}\n",
	"runtimeDataModel": {
		"models": {},
		"enums": {},
		"types": {}
	},
	"parameterizationSchema": {
		"strings": [],
		"graph": ""
	}
};
config$1.runtimeDataModel = JSON.parse("{\"models\":{\"User\":{\"fields\":[{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"user_id\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"firstName\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"first_name\"},{\"name\":\"lastName\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"last_name\"},{\"name\":\"phone\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"avatar\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"bio\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"passwordHash\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"password_hash\"},{\"name\":\"isEmailVerified\",\"kind\":\"scalar\",\"type\":\"Boolean\",\"dbName\":\"is_email_verified\"},{\"name\":\"isActive\",\"kind\":\"scalar\",\"type\":\"Boolean\",\"dbName\":\"is_active\"},{\"name\":\"role\",\"kind\":\"enum\",\"type\":\"UserRole\"},{\"name\":\"verifyCodeHash\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"verify_code_hash\"},{\"name\":\"verifiedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"verified_at\"},{\"name\":\"verifyCodeExpiry\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"verify_code_expiry\"},{\"name\":\"googleId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"google_id\"},{\"name\":\"facebookId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"facebook_id\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"experiences\",\"kind\":\"object\",\"type\":\"experiences\",\"relationName\":\"UserToexperiences\"},{\"name\":\"properties\",\"kind\":\"object\",\"type\":\"properties\",\"relationName\":\"UserToproperties\"},{\"name\":\"reviews\",\"kind\":\"object\",\"type\":\"reviews\",\"relationName\":\"UserToreviews\"},{\"name\":\"saved_properties\",\"kind\":\"object\",\"type\":\"saved_properties\",\"relationName\":\"UserTosaved_properties\"},{\"name\":\"sessions\",\"kind\":\"object\",\"type\":\"Session\",\"relationName\":\"SessionToUser\"},{\"name\":\"agencies\",\"kind\":\"object\",\"type\":\"UserAgency\",\"relationName\":\"UserToUserAgency\"},{\"name\":\"user_credits\",\"kind\":\"object\",\"type\":\"user_credits\",\"relationName\":\"UserTouser_credits\"},{\"name\":\"scoreReports\",\"kind\":\"object\",\"type\":\"ScoreReport\",\"relationName\":\"ScoreReportToUser\"},{\"name\":\"reportOrders\",\"kind\":\"object\",\"type\":\"ReportOrder\",\"relationName\":\"ReportOrderToUser\"},{\"name\":\"billingSubscription\",\"kind\":\"object\",\"type\":\"BillingSubscription\",\"relationName\":\"BillingSubscriptionToUser\"},{\"name\":\"trialStartedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"trial_started_at\"},{\"name\":\"trialEndsAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"trial_ends_at\"}],\"dbName\":\"users\"},\"AnalyticsEvent\":{\"fields\":[{\"name\":\"eventId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"event_id\"},{\"name\":\"eventName\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"event_name\"},{\"name\":\"anonymousId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"anonymous_id\"},{\"name\":\"path\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"referrer\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"}],\"dbName\":\"analytics_events\"},\"Session\":{\"fields\":[{\"name\":\"sessionId\",\"kind\":\"scalar\",\"type\":\"Int\",\"dbName\":\"session_id\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"user_id\"},{\"name\":\"accessTokenId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"access_token_id\"},{\"name\":\"accessTokenExpiry\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"access_token_expiry\"},{\"name\":\"refreshTokenId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"refresh_token_id\"},{\"name\":\"refreshTokenExpiry\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"refresh_token_expiry\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"SessionToUser\"}],\"dbName\":\"sessions\"},\"Agency\":{\"fields\":[{\"name\":\"agencyId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"agency_id\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"phone\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"website\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"isVerified\",\"kind\":\"scalar\",\"type\":\"Boolean\",\"dbName\":\"is_verified\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"UserAgency\",\"relationName\":\"AgencyToUserAgency\"}],\"dbName\":\"agencies\"},\"UserAgency\":{\"fields\":[{\"name\":\"userAgencyId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"user_agency_id\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"user_id\"},{\"name\":\"agencyId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"agency_id\"},{\"name\":\"isVerified\",\"kind\":\"scalar\",\"type\":\"Boolean\",\"dbName\":\"is_verified\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"agency\",\"kind\":\"object\",\"type\":\"Agency\",\"relationName\":\"AgencyToUserAgency\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"UserToUserAgency\"}],\"dbName\":\"user_agency\"},\"Borough\":{\"fields\":[{\"name\":\"boroughId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"borough_id\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"image\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"latitude\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"longitude\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"metrics\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"postcodes\",\"kind\":\"object\",\"type\":\"Postcode\",\"relationName\":\"BoroughToPostcode\"},{\"name\":\"scoreReports\",\"kind\":\"object\",\"type\":\"ScoreReport\",\"relationName\":\"BoroughToScoreReport\"},{\"name\":\"reviews\",\"kind\":\"object\",\"type\":\"reviews\",\"relationName\":\"BoroughToreviews\"}],\"dbName\":\"boroughs\"},\"Postcode\":{\"fields\":[{\"name\":\"postcodeId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"postcode_id\"},{\"name\":\"code\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"outcode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"incode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"latitude\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"longitude\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"imageUrl\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"image_url\"},{\"name\":\"metrics\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"boroughId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"borough_id\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"experiences\",\"kind\":\"object\",\"type\":\"experiences\",\"relationName\":\"PostcodeToexperiences\"},{\"name\":\"borough\",\"kind\":\"object\",\"type\":\"Borough\",\"relationName\":\"BoroughToPostcode\"},{\"name\":\"properties\",\"kind\":\"object\",\"type\":\"properties\",\"relationName\":\"PostcodeToproperties\"},{\"name\":\"reviews\",\"kind\":\"object\",\"type\":\"reviews\",\"relationName\":\"PostcodeToreviews\"},{\"name\":\"scoreReports\",\"kind\":\"object\",\"type\":\"ScoreReport\",\"relationName\":\"PostcodeToScoreReport\"}],\"dbName\":\"postcodes\"},\"ScoreReport\":{\"fields\":[{\"name\":\"scoreReportId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"score_report_id\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"user_id\"},{\"name\":\"boroughId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"borough_id\"},{\"name\":\"postcodeId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"postcode_id\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"ScoreStatus\"},{\"name\":\"overallScore\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"boroughScore\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"postcodeScore\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"scoreBreakdown\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"reportData\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"failureReason\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"deletedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"deleted_at\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"borough\",\"kind\":\"object\",\"type\":\"Borough\",\"relationName\":\"BoroughToScoreReport\"},{\"name\":\"postcode\",\"kind\":\"object\",\"type\":\"Postcode\",\"relationName\":\"PostcodeToScoreReport\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"ScoreReportToUser\"},{\"name\":\"reportOrders\",\"kind\":\"object\",\"type\":\"ReportOrder\",\"relationName\":\"ReportOrderToScoreReport\"}],\"dbName\":\"score_reports\"},\"ReportOrder\":{\"fields\":[{\"name\":\"orderId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"order_id\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"user_id\"},{\"name\":\"scoreReportId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"score_report_id\"},{\"name\":\"stripeSessionId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"stripe_session_id\"},{\"name\":\"stripePaymentIntent\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"stripe_payment_intent\"},{\"name\":\"amount\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"currency\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"OrderStatus\"},{\"name\":\"paidAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"paid_at\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"ReportOrderToUser\"},{\"name\":\"scoreReport\",\"kind\":\"object\",\"type\":\"ScoreReport\",\"relationName\":\"ReportOrderToScoreReport\"}],\"dbName\":\"report_orders\"},\"PaymentWebhookEvent\":{\"fields\":[{\"name\":\"eventId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"event_id\"},{\"name\":\"eventType\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"event_type\"},{\"name\":\"status\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"processedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"processed_at\"}],\"dbName\":\"payment_webhook_events\"},\"BillingSubscription\":{\"fields\":[{\"name\":\"billingSubscriptionId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"billing_subscription_id\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"user_id\"},{\"name\":\"stripeCustomerId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"stripe_customer_id\"},{\"name\":\"stripeSubscriptionId\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"stripe_subscription_id\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"BillingSubscriptionStatus\"},{\"name\":\"currentPeriodEnd\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"current_period_end\"},{\"name\":\"cancelAtPeriodEnd\",\"kind\":\"scalar\",\"type\":\"Boolean\",\"dbName\":\"cancel_at_period_end\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"BillingSubscriptionToUser\"}],\"dbName\":\"billing_subscriptions\"},\"ai_interactions\":{\"fields\":[{\"name\":\"ai_interaction_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"user_credits_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"query\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"response\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"borough\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"tokens_used\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"credits_used\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"downloaded\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"user_credits\",\"kind\":\"object\",\"type\":\"user_credits\",\"relationName\":\"ai_interactionsTouser_credits\"}],\"dbName\":null},\"blog_categories\":{\"fields\":[{\"name\":\"blog_category_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"blog_posts\",\"kind\":\"object\",\"type\":\"blog_posts\",\"relationName\":\"blog_categoriesToblog_posts\"}],\"dbName\":null},\"blog_posts\":{\"fields\":[{\"name\":\"blog_post_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"excerpt\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"content\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"featured_image\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"read_time\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"BlogStatus\"},{\"name\":\"category_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"meta_title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"meta_description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"published_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"blog_categories\",\"kind\":\"object\",\"type\":\"blog_categories\",\"relationName\":\"blog_categoriesToblog_posts\"},{\"name\":\"blog_tags\",\"kind\":\"object\",\"type\":\"blog_tags\",\"relationName\":\"BlogPostToBlogTag\"}],\"dbName\":null},\"blog_tags\":{\"fields\":[{\"name\":\"blog_tag_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"blog_posts\",\"kind\":\"object\",\"type\":\"blog_posts\",\"relationName\":\"BlogPostToBlogTag\"}],\"dbName\":null},\"contact_inquiries\":{\"fields\":[{\"name\":\"contact_inquiry_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"subject\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"message\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"InquiryStatus\"},{\"name\":\"admin_notes\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"credit_transactions\":{\"fields\":[{\"name\":\"credit_transaction_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"user_credits_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"amount\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"type\",\"kind\":\"enum\",\"type\":\"TransactionType\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"balance_after\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"user_credits\",\"kind\":\"object\",\"type\":\"user_credits\",\"relationName\":\"credit_transactionsTouser_credits\"}],\"dbName\":null},\"crime_data\":{\"fields\":[{\"name\":\"crime_data_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"borough\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"crime_type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"crime_rate\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"date\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"source\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"demography\":{\"fields\":[{\"name\":\"demography_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"age_group\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"percentage\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"date\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"source\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"download_history\":{\"fields\":[{\"name\":\"download_history_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"user_credits_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"report_type\",\"kind\":\"enum\",\"type\":\"ReportType\"},{\"name\":\"format\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"borough\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"credits_used\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"user_credits\",\"kind\":\"object\",\"type\":\"user_credits\",\"relationName\":\"download_historyTouser_credits\"}],\"dbName\":null},\"experiences\":{\"fields\":[{\"name\":\"experience_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"enum\",\"type\":\"ExperienceType\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"story\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"landlord_name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"agent_name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"year_of_experience\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"anonymous\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"contact_email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"ExperienceStatus\"},{\"name\":\"admin_notes\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"author_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"published_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"UserToexperiences\"},{\"name\":\"postcodes\",\"kind\":\"object\",\"type\":\"Postcode\",\"relationName\":\"PostcodeToexperiences\"}],\"dbName\":null},\"local_plans\":{\"fields\":[{\"name\":\"local_plan_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"borough\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"category\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"summary\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"indicator\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"forecast_change\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"source\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"newsletter_subscribers\":{\"fields\":[{\"name\":\"newsletter_subscriber_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"confirmed\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"confirm_token\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"properties\":{\"fields\":[{\"name\":\"property_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"enum\",\"type\":\"PropertyType\"},{\"name\":\"listing_type\",\"kind\":\"enum\",\"type\":\"ListingType\"},{\"name\":\"price\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"price_frequency\",\"kind\":\"enum\",\"type\":\"PriceFrequency\"},{\"name\":\"bedrooms\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"bathrooms\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"size\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"furnished\",\"kind\":\"enum\",\"type\":\"FurnishedType\"},{\"name\":\"address\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"latitude\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"longitude\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"features\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"available_from\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"min_tenancy\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"deposit\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"bills\",\"kind\":\"enum\",\"type\":\"BillsIncluded\"},{\"name\":\"epc_rating\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"floor_plan\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"verified\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"featured\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"PropertyStatus\"},{\"name\":\"view_count\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"landlord_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"UserToproperties\"},{\"name\":\"postcodes\",\"kind\":\"object\",\"type\":\"Postcode\",\"relationName\":\"PostcodeToproperties\"},{\"name\":\"property_images\",\"kind\":\"object\",\"type\":\"property_images\",\"relationName\":\"propertiesToproperty_images\"},{\"name\":\"saved_properties\",\"kind\":\"object\",\"type\":\"saved_properties\",\"relationName\":\"propertiesTosaved_properties\"}],\"dbName\":null},\"property_images\":{\"fields\":[{\"name\":\"property_image_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"url\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"alt\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"order\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"property_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"properties\",\"kind\":\"object\",\"type\":\"properties\",\"relationName\":\"propertiesToproperty_images\"}],\"dbName\":null},\"property_valuations\":{\"fields\":[{\"name\":\"property_valuation_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"user_credits_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"property_type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"bedrooms\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"bathrooms\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"floor_area\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"year_built\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"condition\",\"kind\":\"enum\",\"type\":\"PropertyCondition\"},{\"name\":\"current_valuation\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"forecast_valuation\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"forecast_date\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"ai_summary\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"credits_used\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"user_credits\",\"kind\":\"object\",\"type\":\"user_credits\",\"relationName\":\"property_valuationsTouser_credits\"}],\"dbName\":null},\"property_value_data\":{\"fields\":[{\"name\":\"property_value_data_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"value\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"date\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"source\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"rent_data\":{\"fields\":[{\"name\":\"rent_data_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"property_type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"rent\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"date\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"source\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"reviews\":{\"fields\":[{\"name\":\"review_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"content\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"safety_rating\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"transport_rating\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"amenities_rating\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"value_rating\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"overall_rating\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"pros\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"cons\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"years_lived\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"anonymous\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"verified\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"ReviewStatus\"},{\"name\":\"rejection_reason\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"author_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"postcode_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"borough_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"published_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"UserToreviews\"},{\"name\":\"boroughs\",\"kind\":\"object\",\"type\":\"Borough\",\"relationName\":\"BoroughToreviews\"},{\"name\":\"postcodes\",\"kind\":\"object\",\"type\":\"Postcode\",\"relationName\":\"PostcodeToreviews\"}],\"dbName\":null},\"saved_properties\":{\"fields\":[{\"name\":\"saved_property_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"user_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"property_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"properties\",\"kind\":\"object\",\"type\":\"properties\",\"relationName\":\"propertiesTosaved_properties\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"UserTosaved_properties\"}],\"dbName\":null},\"user_credits\":{\"fields\":[{\"name\":\"user_credits_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"user_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"credits_balance\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"subscription_plan\",\"kind\":\"enum\",\"type\":\"SubscriptionPlan\"},{\"name\":\"ai_summary_used\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"ai_summary_limit\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"plan_expires_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"ai_interactions\",\"kind\":\"object\",\"type\":\"ai_interactions\",\"relationName\":\"ai_interactionsTouser_credits\"},{\"name\":\"credit_transactions\",\"kind\":\"object\",\"type\":\"credit_transactions\",\"relationName\":\"credit_transactionsTouser_credits\"},{\"name\":\"download_history\",\"kind\":\"object\",\"type\":\"download_history\",\"relationName\":\"download_historyTouser_credits\"},{\"name\":\"property_valuations\",\"kind\":\"object\",\"type\":\"property_valuations\",\"relationName\":\"property_valuationsTouser_credits\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"UserTouser_credits\"}],\"dbName\":null},\"voting_data\":{\"fields\":[{\"name\":\"voting_data_id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"borough\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"year\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"party\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"percentage\",\"kind\":\"scalar\",\"type\":\"Decimal\"},{\"name\":\"source\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"created_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updated_at\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null}},\"enums\":{},\"types\":{}}");
config$1.parameterizationSchema = {
	strings: JSON.parse("[\"where\",\"orderBy\",\"cursor\",\"users\",\"experiences\",\"postcodes\",\"borough\",\"postcode\",\"user\",\"scoreReport\",\"reportOrders\",\"_count\",\"scoreReports\",\"boroughs\",\"reviews\",\"properties\",\"property_images\",\"saved_properties\",\"sessions\",\"agency\",\"agencies\",\"user_credits\",\"ai_interactions\",\"credit_transactions\",\"download_history\",\"property_valuations\",\"billingSubscription\",\"User.findUnique\",\"User.findUniqueOrThrow\",\"User.findFirst\",\"User.findFirstOrThrow\",\"User.findMany\",\"data\",\"User.createOne\",\"User.createMany\",\"User.createManyAndReturn\",\"User.updateOne\",\"User.updateMany\",\"User.updateManyAndReturn\",\"create\",\"update\",\"User.upsertOne\",\"User.deleteOne\",\"User.deleteMany\",\"having\",\"_min\",\"_max\",\"User.groupBy\",\"User.aggregate\",\"AnalyticsEvent.findUnique\",\"AnalyticsEvent.findUniqueOrThrow\",\"AnalyticsEvent.findFirst\",\"AnalyticsEvent.findFirstOrThrow\",\"AnalyticsEvent.findMany\",\"AnalyticsEvent.createOne\",\"AnalyticsEvent.createMany\",\"AnalyticsEvent.createManyAndReturn\",\"AnalyticsEvent.updateOne\",\"AnalyticsEvent.updateMany\",\"AnalyticsEvent.updateManyAndReturn\",\"AnalyticsEvent.upsertOne\",\"AnalyticsEvent.deleteOne\",\"AnalyticsEvent.deleteMany\",\"AnalyticsEvent.groupBy\",\"AnalyticsEvent.aggregate\",\"Session.findUnique\",\"Session.findUniqueOrThrow\",\"Session.findFirst\",\"Session.findFirstOrThrow\",\"Session.findMany\",\"Session.createOne\",\"Session.createMany\",\"Session.createManyAndReturn\",\"Session.updateOne\",\"Session.updateMany\",\"Session.updateManyAndReturn\",\"Session.upsertOne\",\"Session.deleteOne\",\"Session.deleteMany\",\"_avg\",\"_sum\",\"Session.groupBy\",\"Session.aggregate\",\"Agency.findUnique\",\"Agency.findUniqueOrThrow\",\"Agency.findFirst\",\"Agency.findFirstOrThrow\",\"Agency.findMany\",\"Agency.createOne\",\"Agency.createMany\",\"Agency.createManyAndReturn\",\"Agency.updateOne\",\"Agency.updateMany\",\"Agency.updateManyAndReturn\",\"Agency.upsertOne\",\"Agency.deleteOne\",\"Agency.deleteMany\",\"Agency.groupBy\",\"Agency.aggregate\",\"UserAgency.findUnique\",\"UserAgency.findUniqueOrThrow\",\"UserAgency.findFirst\",\"UserAgency.findFirstOrThrow\",\"UserAgency.findMany\",\"UserAgency.createOne\",\"UserAgency.createMany\",\"UserAgency.createManyAndReturn\",\"UserAgency.updateOne\",\"UserAgency.updateMany\",\"UserAgency.updateManyAndReturn\",\"UserAgency.upsertOne\",\"UserAgency.deleteOne\",\"UserAgency.deleteMany\",\"UserAgency.groupBy\",\"UserAgency.aggregate\",\"Borough.findUnique\",\"Borough.findUniqueOrThrow\",\"Borough.findFirst\",\"Borough.findFirstOrThrow\",\"Borough.findMany\",\"Borough.createOne\",\"Borough.createMany\",\"Borough.createManyAndReturn\",\"Borough.updateOne\",\"Borough.updateMany\",\"Borough.updateManyAndReturn\",\"Borough.upsertOne\",\"Borough.deleteOne\",\"Borough.deleteMany\",\"Borough.groupBy\",\"Borough.aggregate\",\"Postcode.findUnique\",\"Postcode.findUniqueOrThrow\",\"Postcode.findFirst\",\"Postcode.findFirstOrThrow\",\"Postcode.findMany\",\"Postcode.createOne\",\"Postcode.createMany\",\"Postcode.createManyAndReturn\",\"Postcode.updateOne\",\"Postcode.updateMany\",\"Postcode.updateManyAndReturn\",\"Postcode.upsertOne\",\"Postcode.deleteOne\",\"Postcode.deleteMany\",\"Postcode.groupBy\",\"Postcode.aggregate\",\"ScoreReport.findUnique\",\"ScoreReport.findUniqueOrThrow\",\"ScoreReport.findFirst\",\"ScoreReport.findFirstOrThrow\",\"ScoreReport.findMany\",\"ScoreReport.createOne\",\"ScoreReport.createMany\",\"ScoreReport.createManyAndReturn\",\"ScoreReport.updateOne\",\"ScoreReport.updateMany\",\"ScoreReport.updateManyAndReturn\",\"ScoreReport.upsertOne\",\"ScoreReport.deleteOne\",\"ScoreReport.deleteMany\",\"ScoreReport.groupBy\",\"ScoreReport.aggregate\",\"ReportOrder.findUnique\",\"ReportOrder.findUniqueOrThrow\",\"ReportOrder.findFirst\",\"ReportOrder.findFirstOrThrow\",\"ReportOrder.findMany\",\"ReportOrder.createOne\",\"ReportOrder.createMany\",\"ReportOrder.createManyAndReturn\",\"ReportOrder.updateOne\",\"ReportOrder.updateMany\",\"ReportOrder.updateManyAndReturn\",\"ReportOrder.upsertOne\",\"ReportOrder.deleteOne\",\"ReportOrder.deleteMany\",\"ReportOrder.groupBy\",\"ReportOrder.aggregate\",\"PaymentWebhookEvent.findUnique\",\"PaymentWebhookEvent.findUniqueOrThrow\",\"PaymentWebhookEvent.findFirst\",\"PaymentWebhookEvent.findFirstOrThrow\",\"PaymentWebhookEvent.findMany\",\"PaymentWebhookEvent.createOne\",\"PaymentWebhookEvent.createMany\",\"PaymentWebhookEvent.createManyAndReturn\",\"PaymentWebhookEvent.updateOne\",\"PaymentWebhookEvent.updateMany\",\"PaymentWebhookEvent.updateManyAndReturn\",\"PaymentWebhookEvent.upsertOne\",\"PaymentWebhookEvent.deleteOne\",\"PaymentWebhookEvent.deleteMany\",\"PaymentWebhookEvent.groupBy\",\"PaymentWebhookEvent.aggregate\",\"BillingSubscription.findUnique\",\"BillingSubscription.findUniqueOrThrow\",\"BillingSubscription.findFirst\",\"BillingSubscription.findFirstOrThrow\",\"BillingSubscription.findMany\",\"BillingSubscription.createOne\",\"BillingSubscription.createMany\",\"BillingSubscription.createManyAndReturn\",\"BillingSubscription.updateOne\",\"BillingSubscription.updateMany\",\"BillingSubscription.updateManyAndReturn\",\"BillingSubscription.upsertOne\",\"BillingSubscription.deleteOne\",\"BillingSubscription.deleteMany\",\"BillingSubscription.groupBy\",\"BillingSubscription.aggregate\",\"ai_interactions.findUnique\",\"ai_interactions.findUniqueOrThrow\",\"ai_interactions.findFirst\",\"ai_interactions.findFirstOrThrow\",\"ai_interactions.findMany\",\"ai_interactions.createOne\",\"ai_interactions.createMany\",\"ai_interactions.createManyAndReturn\",\"ai_interactions.updateOne\",\"ai_interactions.updateMany\",\"ai_interactions.updateManyAndReturn\",\"ai_interactions.upsertOne\",\"ai_interactions.deleteOne\",\"ai_interactions.deleteMany\",\"ai_interactions.groupBy\",\"ai_interactions.aggregate\",\"blog_categories\",\"blog_posts\",\"blog_tags\",\"blog_categories.findUnique\",\"blog_categories.findUniqueOrThrow\",\"blog_categories.findFirst\",\"blog_categories.findFirstOrThrow\",\"blog_categories.findMany\",\"blog_categories.createOne\",\"blog_categories.createMany\",\"blog_categories.createManyAndReturn\",\"blog_categories.updateOne\",\"blog_categories.updateMany\",\"blog_categories.updateManyAndReturn\",\"blog_categories.upsertOne\",\"blog_categories.deleteOne\",\"blog_categories.deleteMany\",\"blog_categories.groupBy\",\"blog_categories.aggregate\",\"blog_posts.findUnique\",\"blog_posts.findUniqueOrThrow\",\"blog_posts.findFirst\",\"blog_posts.findFirstOrThrow\",\"blog_posts.findMany\",\"blog_posts.createOne\",\"blog_posts.createMany\",\"blog_posts.createManyAndReturn\",\"blog_posts.updateOne\",\"blog_posts.updateMany\",\"blog_posts.updateManyAndReturn\",\"blog_posts.upsertOne\",\"blog_posts.deleteOne\",\"blog_posts.deleteMany\",\"blog_posts.groupBy\",\"blog_posts.aggregate\",\"blog_tags.findUnique\",\"blog_tags.findUniqueOrThrow\",\"blog_tags.findFirst\",\"blog_tags.findFirstOrThrow\",\"blog_tags.findMany\",\"blog_tags.createOne\",\"blog_tags.createMany\",\"blog_tags.createManyAndReturn\",\"blog_tags.updateOne\",\"blog_tags.updateMany\",\"blog_tags.updateManyAndReturn\",\"blog_tags.upsertOne\",\"blog_tags.deleteOne\",\"blog_tags.deleteMany\",\"blog_tags.groupBy\",\"blog_tags.aggregate\",\"contact_inquiries.findUnique\",\"contact_inquiries.findUniqueOrThrow\",\"contact_inquiries.findFirst\",\"contact_inquiries.findFirstOrThrow\",\"contact_inquiries.findMany\",\"contact_inquiries.createOne\",\"contact_inquiries.createMany\",\"contact_inquiries.createManyAndReturn\",\"contact_inquiries.updateOne\",\"contact_inquiries.updateMany\",\"contact_inquiries.updateManyAndReturn\",\"contact_inquiries.upsertOne\",\"contact_inquiries.deleteOne\",\"contact_inquiries.deleteMany\",\"contact_inquiries.groupBy\",\"contact_inquiries.aggregate\",\"credit_transactions.findUnique\",\"credit_transactions.findUniqueOrThrow\",\"credit_transactions.findFirst\",\"credit_transactions.findFirstOrThrow\",\"credit_transactions.findMany\",\"credit_transactions.createOne\",\"credit_transactions.createMany\",\"credit_transactions.createManyAndReturn\",\"credit_transactions.updateOne\",\"credit_transactions.updateMany\",\"credit_transactions.updateManyAndReturn\",\"credit_transactions.upsertOne\",\"credit_transactions.deleteOne\",\"credit_transactions.deleteMany\",\"credit_transactions.groupBy\",\"credit_transactions.aggregate\",\"crime_data.findUnique\",\"crime_data.findUniqueOrThrow\",\"crime_data.findFirst\",\"crime_data.findFirstOrThrow\",\"crime_data.findMany\",\"crime_data.createOne\",\"crime_data.createMany\",\"crime_data.createManyAndReturn\",\"crime_data.updateOne\",\"crime_data.updateMany\",\"crime_data.updateManyAndReturn\",\"crime_data.upsertOne\",\"crime_data.deleteOne\",\"crime_data.deleteMany\",\"crime_data.groupBy\",\"crime_data.aggregate\",\"demography.findUnique\",\"demography.findUniqueOrThrow\",\"demography.findFirst\",\"demography.findFirstOrThrow\",\"demography.findMany\",\"demography.createOne\",\"demography.createMany\",\"demography.createManyAndReturn\",\"demography.updateOne\",\"demography.updateMany\",\"demography.updateManyAndReturn\",\"demography.upsertOne\",\"demography.deleteOne\",\"demography.deleteMany\",\"demography.groupBy\",\"demography.aggregate\",\"download_history.findUnique\",\"download_history.findUniqueOrThrow\",\"download_history.findFirst\",\"download_history.findFirstOrThrow\",\"download_history.findMany\",\"download_history.createOne\",\"download_history.createMany\",\"download_history.createManyAndReturn\",\"download_history.updateOne\",\"download_history.updateMany\",\"download_history.updateManyAndReturn\",\"download_history.upsertOne\",\"download_history.deleteOne\",\"download_history.deleteMany\",\"download_history.groupBy\",\"download_history.aggregate\",\"experiences.findUnique\",\"experiences.findUniqueOrThrow\",\"experiences.findFirst\",\"experiences.findFirstOrThrow\",\"experiences.findMany\",\"experiences.createOne\",\"experiences.createMany\",\"experiences.createManyAndReturn\",\"experiences.updateOne\",\"experiences.updateMany\",\"experiences.updateManyAndReturn\",\"experiences.upsertOne\",\"experiences.deleteOne\",\"experiences.deleteMany\",\"experiences.groupBy\",\"experiences.aggregate\",\"local_plans.findUnique\",\"local_plans.findUniqueOrThrow\",\"local_plans.findFirst\",\"local_plans.findFirstOrThrow\",\"local_plans.findMany\",\"local_plans.createOne\",\"local_plans.createMany\",\"local_plans.createManyAndReturn\",\"local_plans.updateOne\",\"local_plans.updateMany\",\"local_plans.updateManyAndReturn\",\"local_plans.upsertOne\",\"local_plans.deleteOne\",\"local_plans.deleteMany\",\"local_plans.groupBy\",\"local_plans.aggregate\",\"newsletter_subscribers.findUnique\",\"newsletter_subscribers.findUniqueOrThrow\",\"newsletter_subscribers.findFirst\",\"newsletter_subscribers.findFirstOrThrow\",\"newsletter_subscribers.findMany\",\"newsletter_subscribers.createOne\",\"newsletter_subscribers.createMany\",\"newsletter_subscribers.createManyAndReturn\",\"newsletter_subscribers.updateOne\",\"newsletter_subscribers.updateMany\",\"newsletter_subscribers.updateManyAndReturn\",\"newsletter_subscribers.upsertOne\",\"newsletter_subscribers.deleteOne\",\"newsletter_subscribers.deleteMany\",\"newsletter_subscribers.groupBy\",\"newsletter_subscribers.aggregate\",\"properties.findUnique\",\"properties.findUniqueOrThrow\",\"properties.findFirst\",\"properties.findFirstOrThrow\",\"properties.findMany\",\"properties.createOne\",\"properties.createMany\",\"properties.createManyAndReturn\",\"properties.updateOne\",\"properties.updateMany\",\"properties.updateManyAndReturn\",\"properties.upsertOne\",\"properties.deleteOne\",\"properties.deleteMany\",\"properties.groupBy\",\"properties.aggregate\",\"property_images.findUnique\",\"property_images.findUniqueOrThrow\",\"property_images.findFirst\",\"property_images.findFirstOrThrow\",\"property_images.findMany\",\"property_images.createOne\",\"property_images.createMany\",\"property_images.createManyAndReturn\",\"property_images.updateOne\",\"property_images.updateMany\",\"property_images.updateManyAndReturn\",\"property_images.upsertOne\",\"property_images.deleteOne\",\"property_images.deleteMany\",\"property_images.groupBy\",\"property_images.aggregate\",\"property_valuations.findUnique\",\"property_valuations.findUniqueOrThrow\",\"property_valuations.findFirst\",\"property_valuations.findFirstOrThrow\",\"property_valuations.findMany\",\"property_valuations.createOne\",\"property_valuations.createMany\",\"property_valuations.createManyAndReturn\",\"property_valuations.updateOne\",\"property_valuations.updateMany\",\"property_valuations.updateManyAndReturn\",\"property_valuations.upsertOne\",\"property_valuations.deleteOne\",\"property_valuations.deleteMany\",\"property_valuations.groupBy\",\"property_valuations.aggregate\",\"property_value_data.findUnique\",\"property_value_data.findUniqueOrThrow\",\"property_value_data.findFirst\",\"property_value_data.findFirstOrThrow\",\"property_value_data.findMany\",\"property_value_data.createOne\",\"property_value_data.createMany\",\"property_value_data.createManyAndReturn\",\"property_value_data.updateOne\",\"property_value_data.updateMany\",\"property_value_data.updateManyAndReturn\",\"property_value_data.upsertOne\",\"property_value_data.deleteOne\",\"property_value_data.deleteMany\",\"property_value_data.groupBy\",\"property_value_data.aggregate\",\"rent_data.findUnique\",\"rent_data.findUniqueOrThrow\",\"rent_data.findFirst\",\"rent_data.findFirstOrThrow\",\"rent_data.findMany\",\"rent_data.createOne\",\"rent_data.createMany\",\"rent_data.createManyAndReturn\",\"rent_data.updateOne\",\"rent_data.updateMany\",\"rent_data.updateManyAndReturn\",\"rent_data.upsertOne\",\"rent_data.deleteOne\",\"rent_data.deleteMany\",\"rent_data.groupBy\",\"rent_data.aggregate\",\"reviews.findUnique\",\"reviews.findUniqueOrThrow\",\"reviews.findFirst\",\"reviews.findFirstOrThrow\",\"reviews.findMany\",\"reviews.createOne\",\"reviews.createMany\",\"reviews.createManyAndReturn\",\"reviews.updateOne\",\"reviews.updateMany\",\"reviews.updateManyAndReturn\",\"reviews.upsertOne\",\"reviews.deleteOne\",\"reviews.deleteMany\",\"reviews.groupBy\",\"reviews.aggregate\",\"saved_properties.findUnique\",\"saved_properties.findUniqueOrThrow\",\"saved_properties.findFirst\",\"saved_properties.findFirstOrThrow\",\"saved_properties.findMany\",\"saved_properties.createOne\",\"saved_properties.createMany\",\"saved_properties.createManyAndReturn\",\"saved_properties.updateOne\",\"saved_properties.updateMany\",\"saved_properties.updateManyAndReturn\",\"saved_properties.upsertOne\",\"saved_properties.deleteOne\",\"saved_properties.deleteMany\",\"saved_properties.groupBy\",\"saved_properties.aggregate\",\"user_credits.findUnique\",\"user_credits.findUniqueOrThrow\",\"user_credits.findFirst\",\"user_credits.findFirstOrThrow\",\"user_credits.findMany\",\"user_credits.createOne\",\"user_credits.createMany\",\"user_credits.createManyAndReturn\",\"user_credits.updateOne\",\"user_credits.updateMany\",\"user_credits.updateManyAndReturn\",\"user_credits.upsertOne\",\"user_credits.deleteOne\",\"user_credits.deleteMany\",\"user_credits.groupBy\",\"user_credits.aggregate\",\"voting_data.findUnique\",\"voting_data.findUniqueOrThrow\",\"voting_data.findFirst\",\"voting_data.findFirstOrThrow\",\"voting_data.findMany\",\"voting_data.createOne\",\"voting_data.createMany\",\"voting_data.createManyAndReturn\",\"voting_data.updateOne\",\"voting_data.updateMany\",\"voting_data.updateManyAndReturn\",\"voting_data.upsertOne\",\"voting_data.deleteOne\",\"voting_data.deleteMany\",\"voting_data.groupBy\",\"voting_data.aggregate\",\"AND\",\"OR\",\"NOT\",\"voting_data_id\",\"year\",\"party\",\"percentage\",\"source\",\"created_at\",\"updated_at\",\"equals\",\"in\",\"notIn\",\"lt\",\"lte\",\"gt\",\"gte\",\"not\",\"contains\",\"startsWith\",\"endsWith\",\"user_credits_id\",\"user_id\",\"credits_balance\",\"SubscriptionPlan\",\"subscription_plan\",\"ai_summary_used\",\"ai_summary_limit\",\"plan_expires_at\",\"every\",\"some\",\"none\",\"saved_property_id\",\"property_id\",\"review_id\",\"title\",\"content\",\"safety_rating\",\"transport_rating\",\"amenities_rating\",\"value_rating\",\"overall_rating\",\"pros\",\"cons\",\"years_lived\",\"anonymous\",\"verified\",\"ReviewStatus\",\"status\",\"rejection_reason\",\"author_id\",\"postcode_id\",\"borough_id\",\"published_at\",\"has\",\"hasEvery\",\"hasSome\",\"rent_data_id\",\"property_type\",\"rent\",\"date\",\"property_value_data_id\",\"value\",\"property_valuation_id\",\"bedrooms\",\"bathrooms\",\"floor_area\",\"year_built\",\"PropertyCondition\",\"condition\",\"current_valuation\",\"forecast_valuation\",\"forecast_date\",\"ai_summary\",\"credits_used\",\"property_image_id\",\"url\",\"alt\",\"order\",\"description\",\"PropertyType\",\"type\",\"ListingType\",\"listing_type\",\"price\",\"PriceFrequency\",\"price_frequency\",\"size\",\"FurnishedType\",\"furnished\",\"address\",\"latitude\",\"longitude\",\"features\",\"available_from\",\"min_tenancy\",\"deposit\",\"BillsIncluded\",\"bills\",\"epc_rating\",\"floor_plan\",\"featured\",\"PropertyStatus\",\"view_count\",\"landlord_id\",\"newsletter_subscriber_id\",\"email\",\"confirmed\",\"confirm_token\",\"local_plan_id\",\"category\",\"summary\",\"indicator\",\"forecast_change\",\"experience_id\",\"ExperienceType\",\"story\",\"landlord_name\",\"agent_name\",\"year_of_experience\",\"contact_email\",\"ExperienceStatus\",\"admin_notes\",\"download_history_id\",\"ReportType\",\"report_type\",\"format\",\"demography_id\",\"age_group\",\"crime_data_id\",\"crime_type\",\"crime_rate\",\"credit_transaction_id\",\"amount\",\"TransactionType\",\"balance_after\",\"contact_inquiry_id\",\"name\",\"subject\",\"message\",\"InquiryStatus\",\"blog_tag_id\",\"slug\",\"blog_post_id\",\"excerpt\",\"featured_image\",\"read_time\",\"BlogStatus\",\"category_id\",\"meta_title\",\"meta_description\",\"blog_category_id\",\"ai_interaction_id\",\"query\",\"response\",\"tokens_used\",\"downloaded\",\"billingSubscriptionId\",\"userId\",\"stripeCustomerId\",\"stripeSubscriptionId\",\"BillingSubscriptionStatus\",\"currentPeriodEnd\",\"cancelAtPeriodEnd\",\"createdAt\",\"updatedAt\",\"eventId\",\"eventType\",\"processedAt\",\"orderId\",\"scoreReportId\",\"stripeSessionId\",\"stripePaymentIntent\",\"currency\",\"OrderStatus\",\"paidAt\",\"boroughId\",\"postcodeId\",\"ScoreStatus\",\"overallScore\",\"boroughScore\",\"postcodeScore\",\"scoreBreakdown\",\"reportData\",\"failureReason\",\"deletedAt\",\"string_contains\",\"string_starts_with\",\"string_ends_with\",\"array_starts_with\",\"array_ends_with\",\"array_contains\",\"code\",\"outcode\",\"incode\",\"imageUrl\",\"metrics\",\"image\",\"userAgencyId\",\"agencyId\",\"isVerified\",\"phone\",\"website\",\"sessionId\",\"accessTokenId\",\"accessTokenExpiry\",\"refreshTokenId\",\"refreshTokenExpiry\",\"eventName\",\"anonymousId\",\"path\",\"referrer\",\"firstName\",\"lastName\",\"avatar\",\"bio\",\"passwordHash\",\"isEmailVerified\",\"isActive\",\"UserRole\",\"role\",\"verifyCodeHash\",\"verifiedAt\",\"verifyCodeExpiry\",\"googleId\",\"facebookId\",\"trialStartedAt\",\"trialEndsAt\",\"userId_agencyId\",\"user_id_property_id\",\"is\",\"isNot\",\"connectOrCreate\",\"upsert\",\"createMany\",\"set\",\"disconnect\",\"delete\",\"connect\",\"updateMany\",\"deleteMany\",\"push\",\"increment\",\"decrement\",\"multiply\",\"divide\"]"),
	graph: "uw6zAoAEIQQAAMwIACAKAADKCAAgDAAAlggAIA4AAJcIACAPAADNCAAgEQAAvQgAIBIAANAIACAUAACbCAAgFQAA0QgAIBoAANIIACCmBAAAzggAMKcEAAAHABCoBAAAzggAMJAFAQAAAAHEBQEAAAABygVAAIYHACHLBUAAhgcAIe8FAQDNBwAh-gUBAIMHACH7BQEAgwcAIfwFAQDNBwAh_QUBAM0HACH-BQEAzQcAIf8FIADMBwAhgAYgAMwHACGCBgAAzwiCBiKDBgEAzQcAIYQGQACSBwAhhQZAAJIHACGGBgEAAAABhwYBAAAAAYgGQACSBwAhiQZAAJIHACEBAAAAAQAgFQMAAMkIACAFAADCCAAgpgQAANMIADCnBAAAAwAQqAQAANMIADCuBEAAhgcAIa8EQACGBwAhyQQBAIMHACHTBCAAzAcAIdYEAADVCKAFItgEAQD3BwAh2QQBAM0HACHbBEAAkgcAIfcEAADUCJoFIpgFAQCCBwAhmgUBAIMHACGbBQEAzQcAIZwFAQDNBwAhnQUCAPUHACGeBQEAzQcAIaAFAQDNBwAhCgMAAKwJACAFAACfDQAg2AQAAN8IACDZBAAA3wgAINsEAADfCAAgmwUAAN8IACCcBQAA3wgAIJ0FAADfCAAgngUAAN8IACCgBQAA3wgAIBUDAADJCAAgBQAAwggAIKYEAADTCAAwpwQAAAMAEKgEAADTCAAwrgRAAIYHACGvBEAAhgcAIckEAQCDBwAh0wQgAMwHACHWBAAA1QigBSLYBAEA9wcAIdkEAQDNBwAh2wRAAJIHACH3BAAA1AiaBSKYBQEAAAABmgUBAIMHACGbBQEAzQcAIZwFAQDNBwAhnQUCAPUHACGeBQEAzQcAIaAFAQDNBwAhAwAAAAMAIAEAAAQAMAIAAAUAICEEAADMCAAgCgAAyggAIAwAAJYIACAOAACXCAAgDwAAzQgAIBEAAL0IACASAADQCAAgFAAAmwgAIBUAANEIACAaAADSCAAgpgQAAM4IADCnBAAABwAQqAQAAM4IADCQBQEAgwcAIcQFAQCCBwAhygVAAIYHACHLBUAAhgcAIe8FAQDNBwAh-gUBAIMHACH7BQEAgwcAIfwFAQDNBwAh_QUBAM0HACH-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_CAAh0AQAAJsHACDRBAAAmwcAINIEAgD1BwAh0wQgAMwHACHUBCAAzAcAIdYEAADACNYEItcEAQDNBwAh2AQBAIIHACHZBAEAzQcAIdoEAQDNBwAh2wRAAJIHACEDAAAAHQAgAQAAHgAwAgAAHwAgAQAAAAwAIAEAAAAJACABAAAACQAgAQAAABEAIAEAAAAdACAkAwAAlwcAIAUAALsIACAQAAC8CAAgEQAAvQgAIKYEAAC0CAAwpwQAACYAEKgEAAC0CAAwrgRAAIYHACGvBEAAhgcAIccEAQCCBwAhyQQBAIMHACHUBCAAzAcAIdYEAAC6CI0FItkEAQCDBwAh5gQCAIQHACHnBAIAhAcAIfUEAQCDBwAh9wQAALUI9wQi-QQAALYI-QQi-gQQAIUHACH8BAAAtwj8BCL9BAIA9QcAIf8EAAC4CP8EIoAFAQCDBwAhgQUIAJMIACGCBQgAkwgAIYMFAACbBwAghAVAAJIHACGFBQEAzQcAIYYFEACmCAAhiAUAALkIiAUiiQUBAM0HACGKBQEAzQcAIYsFIADMBwAhjQUCAIQHACGOBQEAggcAIQwDAACsCQAgBQAAnw0AIBAAAKANACARAACYDQAg_QQAAN8IACCBBQAA3wgAIIIFAADfCAAghAUAAN8IACCFBQAA3wgAIIYFAADfCAAgiQUAAN8IACCKBQAA3wgAICQDAACXBwAgBQAAuwgAIBAAALwIACARAAC9CAAgpgQAALQIADCnBAAAJgAQqAQAALQIADCuBEAAhgcAIa8EQACGBwAhxwQBAAAAAckEAQCDBwAh1AQgAMwHACHWBAAAugiNBSLZBAEAgwcAIeYEAgCEBwAh5wQCAIQHACH1BAEAgwcAIfcEAAC1CPcEIvkEAAC2CPkEIvoEEACFBwAh_AQAALcI_AQi_QQCAPUHACH_BAAAuAj_BCKABQEAgwcAIYEFCACTCAAhggUIAJMIACGDBQAAmwcAIIQFQACSBwAhhQUBAM0HACGGBRAApggAIYgFAAC5CIgFIokFAQDNBwAhigUBAM0HACGLBSAAzAcAIY0FAgCEBwAhjgUBAIIHACEDAAAAJgAgAQAAJwAwAgAAKAAgCw8AALIIACCmBAAAswgAMKcEAAAqABCoBAAAswgAMK4EQACGBwAhrwRAAIYHACHHBAEAggcAIfEEAQCCBwAh8gQBAIMHACHzBAEAzQcAIfQEAgCEBwAhAg8AAJ4NACDzBAAA3wgAIAsPAACyCAAgpgQAALMIADCnBAAAKgAQqAQAALMIADCuBEAAhgcAIa8EQACGBwAhxwQBAIIHACHxBAEAAAAB8gQBAIMHACHzBAEAzQcAIfQEAgCEBwAhAwAAACoAIAEAACsAMAIAACwAIAoDAACXBwAgDwAAsggAIKYEAACxCAAwpwQAAC4AEKgEAACxCAAwrgRAAIYHACGvBEAAhgcAIbwEAQCCBwAhxgQBAIIHACHHBAEAggcAIQIDAACsCQAgDwAAng0AIAsDAACXBwAgDwAAsggAIKYEAACxCAAwpwQAAC4AEKgEAACxCAAwrgRAAIYHACGvBEAAhgcAIbwEAQCCBwAhxgQBAAAAAccEAQCCBwAhiwYAALAIACADAAAALgAgAQAALwAwAgAAMAAgAQAAACoAIAEAAAAuACADAAAAHQAgAQAAHgAwAgAAHwAgAwAAABEAIAEAABIAMAIAABMAIAEAAAADACABAAAAJgAgAQAAAB0AIAEAAAARACADAAAAJgAgAQAAJwAwAgAAKAAgAwAAAB0AIAEAAB4AMAIAAB8AIAMAAAAuACABAAAvADACAAAwACAMAwAAlwcAIKYEAACdCAAwpwQAAD0AEKgEAACdCAAwxAUBAIIHACHKBUAAhgcAIcsFQACGBwAh8QUCAIQHACHyBQEA9wcAIfMFQACSBwAh9AUBAPcHACH1BUAAkgcAIQEAAAA9ACALCAAAlwcAIBMAAK8IACCmBAAArggAMKcEAAA_ABCoBAAArggAMMQFAQCCBwAhygVAAIYHACHLBUAAhgcAIewFAQCCBwAh7QUBAIIHACHuBSAAzAcAIQIIAACsCQAgEwAAnQ0AIAwIAACXBwAgEwAArwgAIKYEAACuCAAwpwQAAD8AEKgEAACuCAAwxAUBAIIHACHKBUAAhgcAIcsFQACGBwAh7AUBAAAAAe0FAQCCBwAh7gUgAMwHACGKBgAArQgAIAMAAAA_ACABAABAADACAABBACADAAAAPwAgAQAAQAAwAgAAQQAgAQAAAD8AIBEDAACXBwAgFgAAkwcAIBcAAJQHACAYAACVBwAgGQAAlgcAIKYEAACQBwAwpwQAAEUAEKgEAACQBwAwrgRAAIYHACGvBEAAhgcAIbsEAQCCBwAhvAQBAIIHACG9BAIAhAcAIb8EAACRB78EIsAEAgCEBwAhwQQCAIQHACHCBEAAkgcAIQEAAABFACAPBgEAzQcAIQcBAM0HACEVAACnCAAgpgQAAKwIADCnBAAARwAQqAQAAKwIADCuBEAAhgcAIa8EQACGBwAhuwQBAIIHACHwBAIAhAcAIb4FAQCCBwAhvwUBAIMHACHABQEAgwcAIcEFAgD1BwAhwgUgAMwHACEEBgAA3wgAIAcAAN8IACAVAACaDQAgwQUAAN8IACAPBgEAzQcAIQcBAM0HACEVAACnCAAgpgQAAKwIADCnBAAARwAQqAQAAKwIADCuBEAAhgcAIa8EQACGBwAhuwQBAIIHACHwBAIAhAcAIb4FAQAAAAG_BQEAgwcAIcAFAQCDBwAhwQUCAPUHACHCBSAAzAcAIQMAAABHACABAABIADACAABJACAMFQAApwgAIKYEAACqCAAwpwQAAEsAEKgEAACqCAAwrgRAAIYHACGvBEAAhgcAIbsEAQCCBwAh9QQBAIMHACH3BAAAqwitBSKqBQEAggcAIasFAgCEBwAhrQUCAIQHACEBFQAAmg0AIAwVAACnCAAgpgQAAKoIADCnBAAASwAQqAQAAKoIADCuBEAAhgcAIa8EQACGBwAhuwQBAIIHACH1BAEAgwcAIfcEAACrCK0FIqoFAQAAAAGrBQIAhAcAIa0FAgCEBwAhAwAAAEsAIAEAAEwAMAIAAE0AIA0GAQDNBwAhBwEAzQcAIRUAAKcIACCmBAAAqAgAMKcEAABPABCoBAAAqAgAMK4EQACGBwAhrwRAAIYHACG7BAEAggcAIfAEAgCEBwAhoQUBAIIHACGjBQAAqQijBSKkBQEAgwcAIQMGAADfCAAgBwAA3wgAIBUAAJoNACANBgEAzQcAIQcBAM0HACEVAACnCAAgpgQAAKgIADCnBAAATwAQqAQAAKgIADCuBEAAhgcAIa8EQACGBwAhuwQBAIIHACHwBAIAhAcAIaEFAQAAAAGjBQAAqQijBSKkBQEAgwcAIQMAAABPACABAABQADACAABRACAUBwEAgwcAIRUAAKcIACCmBAAApAgAMKcEAABTABCoBAAApAgAMK4EQACGBwAhrwRAAIYHACG7BAEAggcAIeAEAQCDBwAh5QQBAIIHACHmBAIAhAcAIecEAgCEBwAh6AQCAPUHACHpBAIA9QcAIesEAAClCOsEIuwEEACmCAAh7QQQAKYIACHuBEAAkgcAIe8EAQDNBwAh8AQCAIQHACEHFQAAmg0AIOgEAADfCAAg6QQAAN8IACDsBAAA3wgAIO0EAADfCAAg7gQAAN8IACDvBAAA3wgAIBQHAQCDBwAhFQAApwgAIKYEAACkCAAwpwQAAFMAEKgEAACkCAAwrgRAAIYHACGvBEAAhgcAIbsEAQCCBwAh4AQBAIMHACHlBAEAAAAB5gQCAIQHACHnBAIAhAcAIegEAgD1BwAh6QQCAPUHACHrBAAApQjrBCLsBBAApggAIe0EEACmCAAh7gRAAJIHACHvBAEAzQcAIfAEAgCEBwAhAwAAAFMAIAEAAFQAMAIAAFUAIAEAAABHACABAAAASwAgAQAAAE8AIAEAAABTACADAAAAEQAgAQAAEgAwAgAAEwAgAwAAABgAIAEAABkAMAIAABoAIA0IAACXBwAgpgQAAIAIADCnBAAAXQAQqAQAAIAIADDWBAAAgQjIBSLDBQEAggcAIcQFAQCCBwAhxQUBAM0HACHGBQEAgwcAIcgFQACSBwAhyQUgAMwHACHKBUAAhgcAIcsFQACGBwAhAQAAAF0AIAEAAAADACABAAAAJgAgAQAAAB0AIAEAAAAuACABAAAAPwAgAQAAABEAIAEAAAAYACABAAAAAQAgFQQAAJYNACAKAACbDQAgDAAAiwwAIA4AAIwMACAPAACXDQAgEQAAmA0AIBIAAJkNACAUAAClDAAgFQAAmg0AIBoAAJwNACDvBQAA3wgAIPwFAADfCAAg_QUAAN8IACD-BQAA3wgAIIMGAADfCAAghAYAAN8IACCFBgAA3wgAIIYGAADfCAAghwYAAN8IACCIBgAA3wgAIIkGAADfCAAgAwAAAAcAIAEAAGcAMAIAAAEAIAMAAAAHACABAABnADACAAABACADAAAABwAgAQAAZwAwAgAAAQAgHgQAAIwNACAKAACUDQAgDAAAkw0AIA4AAI4NACAPAACNDQAgEQAAjw0AIBIAAJANACAUAACRDQAgFQAAkg0AIBoAAJUNACCQBQEAAAABxAUBAAAAAcoFQAAAAAHLBUAAAAAB7wUBAAAAAfoFAQAAAAH7BQEAAAAB_AUBAAAAAf0FAQAAAAH-BQEAAAAB_wUgAAAAAYAGIAAAAAGCBgAAAIIGAoMGAQAAAAGEBkAAAAABhQZAAAAAAYYGAQAAAAGHBgEAAAABiAZAAAAAAYkGQAAAAAEBIAAAawAgFJAFAQAAAAHEBQEAAAABygVAAAAAAcsFQAAAAAHvBQEAAAAB-gUBAAAAAfsFAQAAAAH8BQEAAAAB_QUBAAAAAf4FAQAAAAH_BSAAAAABgAYgAAAAAYIGAAAAggYCgwYBAAAAAYQGQAAAAAGFBkAAAAABhgYBAAAAAYcGAQAAAAGIBkAAAAABiQZAAAAAAQEgAABtADABIAAAbQAwHgQAALQMACAKAAC8DAAgDAAAuwwAIA4AALYMACAPAAC1DAAgEQAAtwwAIBIAALgMACAUAAC5DAAgFQAAugwAIBoAAL0MACCQBQEA2wgAIcQFAQDbCAAhygVAAN4IACHLBUAA3ggAIe8FAQD5CAAh-gUBANsIACH7BQEA2wgAIfwFAQD5CAAh_QUBAPkIACH-BQEA-QgAIf8FIACgCQAhgAYgAKAJACGCBgAAswyCBiKDBgEA-QgAIYQGQADmCAAhhQZAAOYIACGGBgEA-QgAIYcGAQD5CAAhiAZAAOYIACGJBkAA5ggAIQIAAAABACAgAABwACAUkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACECAAAABwAgIAAAcgAgAgAAAAcAICAAAHIAIAMAAAABACAnAABrACAoAABwACABAAAAAQAgAQAAAAcAIA4LAACwDAAgLQAAsgwAIC4AALEMACDvBQAA3wgAIPwFAADfCAAg_QUAAN8IACD-BQAA3wgAIIMGAADfCAAghAYAAN8IACCFBgAA3wgAIIYGAADfCAAghwYAAN8IACCIBgAA3wgAIIkGAADfCAAgF6YEAACgCAAwpwQAAHkAEKgEAACgCAAwkAUBAPMGACHEBQEA8gYAIcoFQAD2BgAhywVAAPYGACHvBQEAnwcAIfoFAQDzBgAh-wUBAPMGACH8BQEAnwcAIf0FAQCfBwAh_gUBAJ8HACH_BSAAnQcAIYAGIACdBwAhggYAAKEIggYigwYBAJ8HACGEBkAAigcAIYUGQACKBwAhhgYBAJ8HACGHBgEAnwcAIYgGQACKBwAhiQZAAIoHACEDAAAABwAgAQAAeAAwLAAAeQAgAwAAAAcAIAEAAGcAMAIAAAEAIAmmBAAAnwgAMKcEAAB_ABCoBAAAnwgAMMoFQACGBwAhzAUBAAAAAfYFAQCDBwAh9wUBAIIHACH4BQEAgwcAIfkFAQDNBwAhAQAAAHwAIAEAAAB8ACAJpgQAAJ8IADCnBAAAfwAQqAQAAJ8IADDKBUAAhgcAIcwFAQCCBwAh9gUBAIMHACH3BQEAggcAIfgFAQCDBwAh-QUBAM0HACEB-QUAAN8IACADAAAAfwAgAQAAgAEAMAIAAHwAIAMAAAB_ACABAACAAQAwAgAAfAAgAwAAAH8AIAEAAIABADACAAB8ACAGygVAAAAAAcwFAQAAAAH2BQEAAAAB9wUBAAAAAfgFAQAAAAH5BQEAAAABASAAAIQBACAGygVAAAAAAcwFAQAAAAH2BQEAAAAB9wUBAAAAAfgFAQAAAAH5BQEAAAABASAAAIYBADABIAAAhgEAMAbKBUAA3ggAIcwFAQDbCAAh9gUBANsIACH3BQEA2wgAIfgFAQDbCAAh-QUBAPkIACECAAAAfAAgIAAAiQEAIAbKBUAA3ggAIcwFAQDbCAAh9gUBANsIACH3BQEA2wgAIfgFAQDbCAAh-QUBAPkIACECAAAAfwAgIAAAiwEAIAIAAAB_ACAgAACLAQAgAwAAAHwAICcAAIQBACAoAACJAQAgAQAAAHwAIAEAAAB_ACAECwAArQwAIC0AAK8MACAuAACuDAAg-QUAAN8IACAJpgQAAJ4IADCnBAAAkgEAEKgEAACeCAAwygVAAPYGACHMBQEA8gYAIfYFAQDzBgAh9wUBAPIGACH4BQEA8wYAIfkFAQCfBwAhAwAAAH8AIAEAAJEBADAsAACSAQAgAwAAAH8AIAEAAIABADACAAB8ACAMAwAAlwcAIKYEAACdCAAwpwQAAD0AEKgEAACdCAAwxAUBAAAAAcoFQACGBwAhywVAAIYHACHxBQIAAAAB8gUBAPcHACHzBUAAkgcAIfQFAQD3BwAh9QVAAJIHACEBAAAAlQEAIAEAAACVAQAgBQMAAKwJACDyBQAA3wgAIPMFAADfCAAg9AUAAN8IACD1BQAA3wgAIAMAAAA9ACABAACYAQAwAgAAlQEAIAMAAAA9ACABAACYAQAwAgAAlQEAIAMAAAA9ACABAACYAQAwAgAAlQEAIAkDAACsDAAgxAUBAAAAAcoFQAAAAAHLBUAAAAAB8QUCAAAAAfIFAQAAAAHzBUAAAAAB9AUBAAAAAfUFQAAAAAEBIAAAnAEAIAjEBQEAAAABygVAAAAAAcsFQAAAAAHxBQIAAAAB8gUBAAAAAfMFQAAAAAH0BQEAAAAB9QVAAAAAAQEgAACeAQAwASAAAJ4BADAJAwAAqwwAIMQFAQDbCAAhygVAAN4IACHLBUAA3ggAIfEFAgDcCAAh8gUBAPkIACHzBUAA5ggAIfQFAQD5CAAh9QVAAOYIACECAAAAlQEAICAAAKEBACAIxAUBANsIACHKBUAA3ggAIcsFQADeCAAh8QUCANwIACHyBQEA-QgAIfMFQADmCAAh9AUBAPkIACH1BUAA5ggAIQIAAAA9ACAgAACjAQAgAgAAAD0AICAAAKMBACADAAAAlQEAICcAAJwBACAoAAChAQAgAQAAAJUBACABAAAAPQAgCQsAAKYMACAtAACpDAAgLgAAqAwAIE8AAKcMACBQAACqDAAg8gUAAN8IACDzBQAA3wgAIPQFAADfCAAg9QUAAN8IACALpgQAAJwIADCnBAAAqgEAEKgEAACcCAAwxAUBAPIGACHKBUAA9gYAIcsFQAD2BgAh8QUCAPQGACHyBQEA0wcAIfMFQACKBwAh9AUBANMHACH1BUAAigcAIQMAAAA9ACABAACpAQAwLAAAqgEAIAMAAAA9ACABAACYAQAwAgAAlQEAIA0DAACbCAAgpgQAAJoIADCnBAAAsAEAEKgEAACaCAAw9QQBAM0HACGQBQEAAAABrwUBAIMHACHKBUAAhgcAIcsFQACGBwAh7QUBAAAAAe4FIADMBwAh7wUBAM0HACHwBQEAzQcAIQEAAACtAQAgAQAAAK0BACANAwAAmwgAIKYEAACaCAAwpwQAALABABCoBAAAmggAMPUEAQDNBwAhkAUBAM0HACGvBQEAgwcAIcoFQACGBwAhywVAAIYHACHtBQEAggcAIe4FIADMBwAh7wUBAM0HACHwBQEAzQcAIQUDAAClDAAg9QQAAN8IACCQBQAA3wgAIO8FAADfCAAg8AUAAN8IACADAAAAsAEAIAEAALEBADACAACtAQAgAwAAALABACABAACxAQAwAgAArQEAIAMAAACwAQAgAQAAsQEAMAIAAK0BACAKAwAApAwAIPUEAQAAAAGQBQEAAAABrwUBAAAAAcoFQAAAAAHLBUAAAAAB7QUBAAAAAe4FIAAAAAHvBQEAAAAB8AUBAAAAAQEgAAC1AQAgCfUEAQAAAAGQBQEAAAABrwUBAAAAAcoFQAAAAAHLBUAAAAAB7QUBAAAAAe4FIAAAAAHvBQEAAAAB8AUBAAAAAQEgAAC3AQAwASAAALcBADAKAwAAlwwAIPUEAQD5CAAhkAUBAPkIACGvBQEA2wgAIcoFQADeCAAhywVAAN4IACHtBQEA2wgAIe4FIACgCQAh7wUBAPkIACHwBQEA-QgAIQIAAACtAQAgIAAAugEAIAn1BAEA-QgAIZAFAQD5CAAhrwUBANsIACHKBUAA3ggAIcsFQADeCAAh7QUBANsIACHuBSAAoAkAIe8FAQD5CAAh8AUBAPkIACECAAAAsAEAICAAALwBACACAAAAsAEAICAAALwBACADAAAArQEAICcAALUBACAoAAC6AQAgAQAAAK0BACABAAAAsAEAIAcLAACUDAAgLQAAlgwAIC4AAJUMACD1BAAA3wgAIJAFAADfCAAg7wUAAN8IACDwBQAA3wgAIAymBAAAmQgAMKcEAADDAQAQqAQAAJkIADD1BAEAnwcAIZAFAQCfBwAhrwUBAPMGACHKBUAA9gYAIcsFQAD2BgAh7QUBAPIGACHuBSAAnQcAIe8FAQCfBwAh8AUBAJ8HACEDAAAAsAEAIAEAAMIBADAsAADDAQAgAwAAALABACABAACxAQAwAgAArQEAIAEAAABBACABAAAAQQAgAwAAAD8AIAEAAEAAMAIAAEEAIAMAAAA_ACABAABAADACAABBACADAAAAPwAgAQAAQAAwAgAAQQAgCAgAAJMMACATAACSDAAgxAUBAAAAAcoFQAAAAAHLBUAAAAAB7AUBAAAAAe0FAQAAAAHuBSAAAAABASAAAMsBACAGxAUBAAAAAcoFQAAAAAHLBUAAAAAB7AUBAAAAAe0FAQAAAAHuBSAAAAABASAAAM0BADABIAAAzQEAMAgIAACRDAAgEwAAkAwAIMQFAQDbCAAhygVAAN4IACHLBUAA3ggAIewFAQDbCAAh7QUBANsIACHuBSAAoAkAIQIAAABBACAgAADQAQAgBsQFAQDbCAAhygVAAN4IACHLBUAA3ggAIewFAQDbCAAh7QUBANsIACHuBSAAoAkAIQIAAAA_ACAgAADSAQAgAgAAAD8AICAAANIBACADAAAAQQAgJwAAywEAICgAANABACABAAAAQQAgAQAAAD8AIAMLAACNDAAgLQAAjwwAIC4AAI4MACAJpgQAAJgIADCnBAAA2QEAEKgEAACYCAAwxAUBAPIGACHKBUAA9gYAIcsFQAD2BgAh7AUBAPIGACHtBQEA8gYAIe4FIACdBwAhAwAAAD8AIAEAANgBADAsAADZAQAgAwAAAD8AIAEAAEAAMAIAAEEAIBAFAACVCAAgDAAAlggAIA4AAJcIACCmBAAAkggAMKcEAAAMABCoBAAAkggAMPUEAQDNBwAhgQUIAJMIACGCBQgAkwgAIa8FAQAAAAG0BQEAAAABygVAAIYHACHLBUAAhgcAIdYFAQAAAAHqBQAAlAgAIOsFAQDNBwAhAQAAANwBACABAAAA3AEAIAcFAACKDAAgDAAAiwwAIA4AAIwMACD1BAAA3wgAIIEFAADfCAAgggUAAN8IACDrBQAA3wgAIAMAAAAMACABAADfAQAwAgAA3AEAIAMAAAAMACABAADfAQAwAgAA3AEAIAMAAAAMACABAADfAQAwAgAA3AEAIA0FAACHDAAgDAAAiAwAIA4AAIkMACD1BAEAAAABgQUIAAAAAYIFCAAAAAGvBQEAAAABtAUBAAAAAcoFQAAAAAHLBUAAAAAB1gUBAAAAAeoFgAAAAAHrBQEAAAABASAAAOMBACAK9QQBAAAAAYEFCAAAAAGCBQgAAAABrwUBAAAAAbQFAQAAAAHKBUAAAAABywVAAAAAAdYFAQAAAAHqBYAAAAAB6wUBAAAAAQEgAADlAQAwASAAAOUBADANBQAA5gsAIAwAAOcLACAOAADoCwAg9QQBAPkIACGBBQgA5gkAIYIFCADmCQAhrwUBANsIACG0BQEA2wgAIcoFQADeCAAhywVAAN4IACHWBQEA2wgAIeoFgAAAAAHrBQEA-QgAIQIAAADcAQAgIAAA6AEAIAr1BAEA-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-CgAgLQAAgQsAIC4AAIALACBPAAD_CgAgUAAAggsAINEFAADfCAAg0gUAAN8IACDVBQAA3wgAIA6mBAAAhAgAMKcEAAC7AgAQqAQAAIQIADDWBAAAhQjVBSKrBQIA9AYAIcQFAQDyBgAhygVAAPYGACHLBUAA9gYAIc8FAQDyBgAh0AUBAPMGACHRBQEAnwcAIdIFAQCfBwAh0wUBAPMGACHVBUAAigcAIQMAAAAYACABAAC6AgAwLAAAuwIAIAMAAAAYACABAAAZADACAAAaACAHpgQAAIMIADCnBAAAwQIAEKgEAACDCAAw1gQBAIMHACHMBQEAAAABzQUBAIMHACHOBUAAhgcAIQEAAAC-AgAgAQAAAL4CACAHpgQAAIMIADCnBAAAwQIAEKgEAACDCAAw1gQBAIMHACHMBQEAgwcAIc0FAQCDBwAhzgVAAIYHACEAAwAAAMECACABAADCAgAwAgAAvgIAIAMAAADBAgAgAQAAwgIAMAIAAL4CACADAAAAwQIAIAEAAMICADACAAC-AgAgBNYEAQAAAAHMBQEAAAABzQUBAAAAAc4FQAAAAAEBIAAAxgIAIATWBAEAAAABzAUBAAAAAc0FAQAAAAHOBUAAAAABASAAAMgCADABIAAAyAIAMATWBAEA2wgAIcwFAQDbCAAhzQUBANsIACHOBUAA3ggAIQIAAAC-AgAgIAAAywIAIATWBAEA2wgAIcwFAQDbCAAhzQUBANsIACHOBUAA3ggAIQIAAADBAgAgIAAAzQIAIAIAAADBAgAgIAAAzQIAIAMAAAC-AgAgJwAAxgIAICgAAMsCACABAAAAvgIAIAEAAADBAgAgAwsAAPsKACAtAAD9CgAgLgAA_AoAIAemBAAAgggAMKcEAADUAgAQqAQAAIIIADDWBAEA8wYAIcwFAQDzBgAhzQUBAPMGACHOBUAA9gYAIQMAAADBAgAgAQAA0wIAMCwAANQCACADAAAAwQIAIAEAAMICADACAAC-AgAgDQgAAJcHACCmBAAAgAgAMKcEAABdABCoBAAAgAgAMNYEAACBCMgFIsMFAQAAAAHEBQEAAAABxQUBAM0HACHGBQEAAAAByAVAAJIHACHJBSAAzAcAIcoFQACGBwAhywVAAIYHACEBAAAA1wIAIAEAAADXAgAgAwgAAKwJACDFBQAA3wgAIMgFAADfCAAgAwAAAF0AIAEAANoCADACAADXAgAgAwAAAF0AIAEAANoCADACAADXAgAgAwAAAF0AIAEAANoCADACAADXAgAgCggAAPoKACDWBAAAAMgFAsMFAQAAAAHEBQEAAAABxQUBAAAAAcYFAQAAAAHIBUAAAAAByQUgAAAAAcoFQAAAAAHLBUAAAAABASAAAN4CACAJ1gQAAADIBQLDBQEAAAABxAUBAAAAAcUFAQAAAAHGBQEAAAAByAVAAAAAAckFIAAAAAHKBUAAAAABywVAAAAAAQEgAADgAgAwASAAAOACADAKCAAA-QoAINYEAAD4CsgFIsMFAQDbCAAhxAUBANsIACHFBQEA-QgAIcYFAQDbCAAhyAVAAOYIACHJBSAAoAkAIcoFQADeCAAhywVAAN4IACECAAAA1wIAICAAAOMCACAJ1gQAAPgKyAUiwwUBANsIACHEBQEA2wgAIcUFAQD5CAAhxgUBANsIACHIBUAA5ggAIckFIACgCQAhygVAAN4IACHLBUAA3ggAIQIAAABdACAgAADlAgAgAgAAAF0AICAAAOUCACADAAAA1wIAICcAAN4CACAoAADjAgAgAQAAANcCACABAAAAXQAgBQsAAPUKACAtAAD3CgAgLgAA9goAIMUFAADfCAAgyAUAAN8IACAMpgQAAPwHADCnBAAA7AIAEKgEAAD8BwAw1gQAAP0HyAUiwwUBAPIGACHEBQEA8gYAIcUFAQCfBwAhxgUBAPMGACHIBUAAigcAIckFIACdBwAhygVAAPYGACHLBUAA9gYAIQMAAABdACABAADrAgAwLAAA7AIAIAMAAABdACABAADaAgAwAgAA1wIAIAEAAABJACABAAAASQAgAwAAAEcAIAEAAEgAMAIAAEkAIAMAAABHACABAABIADACAABJACADAAAARwAgAQAASAAwAgAASQAgDAYBAAAAAQcBAAAAARUAAPQKACCuBEAAAAABrwRAAAAAAbsEAQAAAAHwBAIAAAABvgUBAAAAAb8FAQAAAAHABQEAAAABwQUCAAAAAcIFIAAAAAEBIAAA9AIAIAsGAQAAAAEHAQAAAAGuBEAAAAABrwRAAAAAAbsEAQAAAAHwBAIAAAABvgUBAAAAAb8FAQAAAAHABQEAAAABwQUCAAAAAcIFIAAAAAEBIAAA9gIAMAEgAAD2AgAwDAYBAPkIACEHAQD5CAAhFQAA8woAIK4EQADeCAAhrwRAAN4IACG7BAEA2wgAIfAEAgDcCAAhvgUBANsIACG_BQEA2wgAIcAFAQDbCAAhwQUCAPYIACHCBSAAoAkAIQIAAABJACAgAAD5AgAgCwYBAPkIACEHAQD5CAAhrgRAAN4IACGvBEAA3ggAIbsEAQDbCAAh8AQCANwIACG-BQEA2wgAIb8FAQDbCAAhwAUBANsIACHBBQIA9ggAIcIFIACgCQAhAgAAAEcAICAAAPsCACACAAAARwAgIAAA-wIAIAMAAABJACAnAAD0AgAgKAAA-QIAIAEAAABJACABAAAARwAgCAYAAN8IACAHAADfCAAgCwAA7goAIC0AAPEKACAuAADwCgAgTwAA7woAIFAAAPIKACDBBQAA3wgAIA4GAQCfBwAhBwEAnwcAIaYEAAD7BwAwpwQAAIIDABCoBAAA-wcAMK4EQAD2BgAhrwRAAPYGACG7BAEA8gYAIfAEAgD0BgAhvgUBAPIGACG_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_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_BAAgCQYBAAAAAQcBAAAAAa4EQAAAAAGvBEAAAAABuwQBAAAAAfAEAgAAAAGhBQEAAAABowUAAACjBQKkBQEAAAABASAAAMEEADABIAAAwQQAMAoGAQD5CAAhBwEA-QgAIRUAAKEKACCuBEAA3ggAIa8EQADeCAAhuwQBANsIACHwBAIA3AgAIaEFAQDbCAAhowUAAIYJowUipAUBANsIACECAAAAUQAgIAAAxAQAIAkGAQD5CAAhBwEA-QgAIa4EQADeCAAhrwRAAN4IACG7BAEA2wgAIfAEAgDcCAAhoQUBANsIACGjBQAAhgmjBSKkBQEA2wgAIQIAAABPACAgAADGBAAgAgAAAE8AICAAAMYEACADAAAAUQAgJwAAvwQAICgAAMQEACABAAAAUQAgAQAAAE8AIAcGAADfCAAgBwAA3wgAIAsAAJwKACAtAACfCgAgLgAAngoAIE8AAJ0KACBQAACgCgAgDAYBAJ8HACEHAQCfBwAhpgQAANkHADCnBAAAzQQAEKgEAADZBwAwrgRAAPYGACGvBEAA9gYAIbsEAQDyBgAh8AQCAPQGACGhBQEA8gYAIaMFAADaB6MFIqQFAQDzBgAhAwAAAE8AIAEAAMwEADAsAADNBAAgAwAAAE8AIAEAAFAAMAIAAFEAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgEgMAAJoKACAFAACbCgAgrgRAAAAAAa8EQAAAAAHJBAEAAAAB0wQgAAAAAdYEAAAAoAUC2AQBAAAAAdkEAQAAAAHbBEAAAAAB9wQAAACaBQKYBQEAAAABmgUBAAAAAZsFAQAAAAGcBQEAAAABnQUCAAAAAZ4FAQAAAAGgBQEAAAABASAAANUEACAQrgRAAAAAAa8EQAAAAAHJBAEAAAAB0wQgAAAAAdYEAAAAoAUC2AQBAAAAAdkEAQAAAAHbBEAAAAAB9wQAAACaBQKYBQEAAAABmgUBAAAAAZsFAQAAAAGcBQEAAAABnQUCAAAAAZ4FAQAAAAGgBQEAAAABASAAANcEADABIAAA1wQAMAEAAAAHACABAAAACQAgEgMAAJgKACAFAACZCgAgrgRAAN4IACGvBEAA3ggAIckEAQDbCAAh0wQgAKAJACHWBAAAlwqgBSLYBAEA-QgAIdkEAQD5CAAh2wRAAOYIACH3BAAAlgqaBSKYBQEA2wgAIZoFAQDbCAAhmwUBAPkIACGcBQEA-QgAIZ0FAgD2CAAhngUBAPkIACGgBQEA-QgAIQIAAAAFACAgAADcBAAgEK4EQADeCAAhrwRAAN4IACHJBAEA2wgAIdMEIACgCQAh1gQAAJcKoAUi2AQBAPkIACHZBAEA-QgAIdsEQADmCAAh9wQAAJYKmgUimAUBANsIACGaBQEA2wgAIZsFAQD5CAAhnAUBAPkIACGdBQIA9ggAIZ4FAQD5CAAhoAUBAPkIACECAAAAAwAgIAAA3gQAIAIAAAADACAgAADeBAAgAQAAAAcAIAEAAAAJACADAAAABQAgJwAA1QQAICgAANwEACABAAAABQAgAQAAAAMAIA0LAACRCgAgLQAAlAoAIC4AAJMKACBPAACSCgAgUAAAlQoAINgEAADfCAAg2QQAAN8IACDbBAAA3wgAIJsFAADfCAAgnAUAAN8IACCdBQAA3wgAIJ4FAADfCAAgoAUAAN8IACATpgQAANAHADCnBAAA5wQAEKgEAADQBwAwrgRAAPYGACGvBEAA9gYAIckEAQDzBgAh0wQgAJ0HACHWBAAA0gegBSLYBAEA0wcAIdkEAQCfBwAh2wRAAIoHACH3BAAA0QeaBSKYBQEA8gYAIZoFAQDzBgAhmwUBAJ8HACGcBQEAnwcAIZ0FAgCcBwAhngUBAJ8HACGgBQEAnwcAIQMAAAADACABAADmBAAwLAAA5wQAIAMAAAADACABAAAEADACAAAFACAMBgEAgwcAIaYEAADPBwAwpwQAAO0EABCoBAAAzwcAMK0EAQCDBwAhrgRAAIYHACGvBEAAhgcAIZMFAQAAAAGUBQEAgwcAIZUFAQCDBwAhlgUBAM0HACGXBQEAzQcAIQEAAADqBAAgAQAAAOoEACAMBgEAgwcAIaYEAADPBwAwpwQAAO0EABCoBAAAzwcAMK0EAQCDBwAhrgRAAIYHACGvBEAAhgcAIZMFAQCCBwAhlAUBAIMHACGVBQEAgwcAIZYFAQDNBwAhlwUBAM0HACEClgUAAN8IACCXBQAA3wgAIAMAAADtBAAgAQAA7gQAMAIAAOoEACADAAAA7QQAIAEAAO4EADACAADqBAAgAwAAAO0EACABAADuBAAwAgAA6gQAIAkGAQAAAAGtBAEAAAABrgRAAAAAAa8EQAAAAAGTBQEAAAABlAUBAAAAAZUFAQAAAAGWBQEAAAABlwUBAAAAAQEgAADyBAAgCQYBAAAAAa0EAQAAAAGuBEAAAAABrwRAAAAAAZMFAQAAAAGUBQEAAAABlQUBAAAAAZYFAQAAAAGXBQEAAAABASAAAPQEADABIAAA9AQAMAkGAQDbCAAhrQQBANsIACGuBEAA3ggAIa8EQADeCAAhkwUBANsIACGUBQEA2wgAIZUFAQDbCAAhlgUBAPkIACGXBQEA-QgAIQIAAADqBAAgIAAA9wQAIAkGAQDbCAAhrQQBANsIACGuBEAA3ggAIa8EQADeCAAhkwUBANsIACGUBQEA2wgAIZUFAQDbCAAhlgUBAPkIACGXBQEA-QgAIQIAAADtBAAgIAAA-QQAIAIAAADtBAAgIAAA-QQAIAMAAADqBAAgJwAA8gQAICgAAPcEACABAAAA6gQAIAEAAADtBAAgBQsAAI4KACAtAACQCgAgLgAAjwoAIJYFAADfCAAglwUAAN8IACAMBgEA8wYAIaYEAADOBwAwpwQAAIAFABCoBAAAzgcAMK0EAQDzBgAhrgRAAPYGACGvBEAA9gYAIZMFAQDyBgAhlAUBAPMGACGVBQEA8wYAIZYFAQCfBwAhlwUBAJ8HACEDAAAA7QQAIAEAAP8EADAsAACABQAgAwAAAO0EACABAADuBAAwAgAA6gQAIAmmBAAAywcAMKcEAACGBQAQqAQAAMsHADCuBEAAhgcAIa8EQACGBwAhjwUBAAAAAZAFAQAAAAGRBSAAzAcAIZIFAQDNBwAhAQAAAIMFACABAAAAgwUAIAmmBAAAywcAMKcEAACGBQAQqAQAAMsHADCuBEAAhgcAIa8EQACGBwAhjwUBAIIHACGQBQEAgwcAIZEFIADMBwAhkgUBAM0HACEBkgUAAN8IACADAAAAhgUAIAEAAIcFADACAACDBQAgAwAAAIYFACABAACHBQAwAgAAgwUAIAMAAACGBQAgAQAAhwUAMAIAAIMFACAGrgRAAAAAAa8EQAAAAAGPBQEAAAABkAUBAAAAAZEFIAAAAAGSBQEAAAABASAAAIsFACAGrgRAAAAAAa8EQAAAAAGPBQEAAAABkAUBAAAAAZEFIAAAAAGSBQEAAAABASAAAI0FADABIAAAjQUAMAauBEAA3ggAIa8EQADeCAAhjwUBANsIACGQBQEA2wgAIZEFIACgCQAhkgUBAPkIACECAAAAgwUAICAAAJAFACAGrgRAAN4IACGvBEAA3ggAIY8FAQDbCAAhkAUBANsIACGRBSAAoAkAIZIFAQD5CAAhAgAAAIYFACAgAACSBQAgAgAAAIYFACAgAACSBQAgAwAAAIMFACAnAACLBQAgKAAAkAUAIAEAAACDBQAgAQAAAIYFACAECwAAiwoAIC0AAI0KACAuAACMCgAgkgUAAN8IACAJpgQAAMoHADCnBAAAmQUAEKgEAADKBwAwrgRAAPYGACGvBEAA9gYAIY8FAQDyBgAhkAUBAPMGACGRBSAAnQcAIZIFAQCfBwAhAwAAAIYFACABAACYBQAwLAAAmQUAIAMAAACGBQAgAQAAhwUAMAIAAIMFACABAAAAKAAgAQAAACgAIAMAAAAmACABAAAnADACAAAoACADAAAAJgAgAQAAJwAwAgAAKAAgAwAAACYAIAEAACcAMAIAACgAICEDAACHCgAgBQAAiAoAIBAAAIkKACARAACKCgAgrgRAAAAAAa8EQAAAAAHHBAEAAAAByQQBAAAAAdQEIAAAAAHWBAAAAI0FAtkEAQAAAAHmBAIAAAAB5wQCAAAAAfUEAQAAAAH3BAAAAPcEAvkEAAAA-QQC-gQQAAAAAfwEAAAA_AQC_QQCAAAAAf8EAAAA_wQCgAUBAAAAAYEFCAAAAAGCBQgAAAABgwUAAIYKACCEBUAAAAABhQUBAAAAAYYFEAAAAAGIBQAAAIgFAokFAQAAAAGKBQEAAAABiwUgAAAAAY0FAgAAAAGOBQEAAAABASAAAKEFACAdrgRAAAAAAa8EQAAAAAHHBAEAAAAByQQBAAAAAdQEIAAAAAHWBAAAAI0FAtkEAQAAAAHmBAIAAAAB5wQCAAAAAfUEAQAAAAH3BAAAAPcEAvkEAAAA-QQC-gQQAAAAAfwEAAAA_AQC_QQCAAAAAf8EAAAA_wQCgAUBAAAAAYEFCAAAAAGCBQgAAAABgwUAAIYKACCEBUAAAAABhQUBAAAAAYYFEAAAAAGIBQAAAIgFAokFAQAAAAGKBQEAAAABiwUgAAAAAY0FAgAAAAGOBQEAAAABASAAAKMFADABIAAAowUAMCEDAADqCQAgBQAA6wkAIBAAAOwJACARAADtCQAgrgRAAN4IACGvBEAA3ggAIccEAQDbCAAhyQQBANsIACHUBCAAoAkAIdYEAADpCY0FItkEAQDbCAAh5gQCANwIACHnBAIA3AgAIfUEAQDbCAAh9wQAAOIJ9wQi-QQAAOMJ-QQi-gQQAN0IACH8BAAA5An8BCL9BAIA9ggAIf8EAADlCf8EIoAFAQDbCAAhgQUIAOYJACGCBQgA5gkAIYMFAADnCQAghAVAAOYIACGFBQEA-QgAIYYFEAD4CAAhiAUAAOgJiAUiiQUBAPkIACGKBQEA-QgAIYsFIACgCQAhjQUCANwIACGOBQEA2wgAIQIAAAAoACAgAACmBQAgHa4EQADeCAAhrwRAAN4IACHHBAEA2wgAIckEAQDbCAAh1AQgAKAJACHWBAAA6QmNBSLZBAEA2wgAIeYEAgDcCAAh5wQCANwIACH1BAEA2wgAIfcEAADiCfcEIvkEAADjCfkEIvoEEADdCAAh_AQAAOQJ_AQi_QQCAPYIACH_BAAA5Qn_BCKABQEA2wgAIYEFCADmCQAhggUIAOYJACGDBQAA5wkAIIQFQADmCAAhhQUBAPkIACGGBRAA-AgAIYgFAADoCYgFIokFAQD5CAAhigUBAPkIACGLBSAAoAkAIY0FAgDcCAAhjgUBANsIACECAAAAJgAgIAAAqAUAIAIAAAAmACAgAACoBQAgAwAAACgAICcAAKEFACAoAACmBQAgAQAAACgAIAEAAAAmACANCwAA3QkAIC0AAOAJACAuAADfCQAgTwAA3gkAIFAAAOEJACD9BAAA3wgAIIEFAADfCAAgggUAAN8IACCEBQAA3wgAIIUFAADfCAAghgUAAN8IACCJBQAA3wgAIIoFAADfCAAgIKYEAAC1BwAwpwQAAK8FABCoBAAAtQcAMK4EQAD2BgAhrwRAAPYGACHHBAEA8gYAIckEAQDzBgAh1AQgAJ0HACHWBAAAvAeNBSLZBAEA8wYAIeYEAgD0BgAh5wQCAPQGACH1BAEA8wYAIfcEAAC2B_cEIvkEAAC3B_kEIvoEEAD1BgAh_AQAALgH_AQi_QQCAJwHACH_BAAAuQf_BCKABQEA8wYAIYEFCAC6BwAhggUIALoHACGDBQAAmwcAIIQFQACKBwAhhQUBAJ8HACGGBRAArwcAIYgFAAC7B4gFIokFAQCfBwAhigUBAJ8HACGLBSAAnQcAIY0FAgD0BgAhjgUBAPIGACEDAAAAJgAgAQAArgUAMCwAAK8FACADAAAAJgAgAQAAJwAwAgAAKAAgAQAAACwAIAEAAAAsACADAAAAKgAgAQAAKwAwAgAALAAgAwAAACoAIAEAACsAMAIAACwAIAMAAAAqACABAAArADACAAAsACAIDwAA3AkAIK4EQAAAAAGvBEAAAAABxwQBAAAAAfEEAQAAAAHyBAEAAAAB8wQBAAAAAfQEAgAAAAEBIAAAtwUAIAeuBEAAAAABrwRAAAAAAccEAQAAAAHxBAEAAAAB8gQBAAAAAfMEAQAAAAH0BAIAAAABASAAALkFADABIAAAuQUAMAgPAADbCQAgrgRAAN4IACGvBEAA3ggAIccEAQDbCAAh8QQBANsIACHyBAEA2wgAIfMEAQD5CAAh9AQCANwIACECAAAALAAgIAAAvAUAIAeuBEAA3ggAIa8EQADeCAAhxwQBANsIACHxBAEA2wgAIfIEAQDbCAAh8wQBAPkIACH0BAIA3AgAIQIAAAAqACAgAAC-BQAgAgAAACoAICAAAL4FACADAAAALAAgJwAAtwUAICgAALwFACABAAAALAAgAQAAACoAIAYLAADWCQAgLQAA2QkAIC4AANgJACBPAADXCQAgUAAA2gkAIPMEAADfCAAgCqYEAAC0BwAwpwQAAMUFABCoBAAAtAcAMK4EQAD2BgAhrwRAAPYGACHHBAEA8gYAIfEEAQDyBgAh8gQBAPMGACHzBAEAnwcAIfQEAgD0BgAhAwAAACoAIAEAAMQFADAsAADFBQAgAwAAACoAIAEAACsAMAIAACwAIAEAAABVACABAAAAVQAgAwAAAFMAIAEAAFQAMAIAAFUAIAMAAABTACABAABUADACAABVACADAAAAUwAgAQAAVAAwAgAAVQAgEQcBAAAAARUAANUJACCuBEAAAAABrwRAAAAAAbsEAQAAAAHgBAEAAAAB5QQBAAAAAeYEAgAAAAHnBAIAAAAB6AQCAAAAAekEAgAAAAHrBAAAAOsEAuwEEAAAAAHtBBAAAAAB7gRAAAAAAe8EAQAAAAHwBAIAAAABASAAAM0FACAQBwEAAAABrgRAAAAAAa8EQAAAAAG7BAEAAAAB4AQBAAAAAeUEAQAAAAHmBAIAAAAB5wQCAAAAAegEAgAAAAHpBAIAAAAB6wQAAADrBALsBBAAAAAB7QQQAAAAAe4EQAAAAAHvBAEAAAAB8AQCAAAAAQEgAADPBQAwASAAAM8FADARBwEA2wgAIRUAANQJACCuBEAA3ggAIa8EQADeCAAhuwQBANsIACHgBAEA2wgAIeUEAQDbCAAh5gQCANwIACHnBAIA3AgAIegEAgD2CAAh6QQCAPYIACHrBAAA9wjrBCLsBBAA-AgAIe0EEAD4CAAh7gRAAOYIACHvBAEA-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_BQAgCAcBAAAAAa0EAQAAAAGuBEAAAAABrwRAAAAAAd8EAQAAAAHgBAEAAAAB4QQQAAAAAeIEQAAAAAEBIAAAgQYAMAEgAACBBgAwCAcBANsIACGtBAEA2wgAIa4EQADeCAAhrwRAAN4IACHfBAEA2wgAIeAEAQDbCAAh4QQQAN0IACHiBEAA3ggAIQIAAAD3BQAgIAAAhAYAIAgHAQDbCAAhrQQBANsIACGuBEAA3ggAIa8EQADeCAAh3wQBANsIACHgBAEA2wgAIeEEEADdCAAh4gRAAN4IACECAAAA-gUAICAAAIYGACACAAAA-gUAICAAAIYGACADAAAA9wUAICcAAP8FACAoAACEBgAgAQAAAPcFACABAAAA-gUAIAULAADFCQAgLQAAyAkAIC4AAMcJACBPAADGCQAgUAAAyQkAIAsHAQDzBgAhpgQAAKkHADCnBAAAjQYAEKgEAACpBwAwrQQBAPMGACGuBEAA9gYAIa8EQAD2BgAh3wQBAPIGACHgBAEA8wYAIeEEEAD1BgAh4gRAAPYGACEDAAAA-gUAIAEAAIwGADAsAACNBgAgAwAAAPoFACABAAD7BQAwAgAA9wUAIAEAAAAfACABAAAAHwAgAwAAAB0AIAEAAB4AMAIAAB8AIAMAAAAdACABAAAeADACAAAfACADAAAAHQAgAQAAHgAwAgAAHwAgGAMAAMIJACAFAADECQAgDQAAwwkAIK4EQAAAAAGvBEAAAAAByAQBAAAAAckEAQAAAAHKBAEAAAABywQCAAAAAcwEAgAAAAHNBAIAAAABzgQCAAAAAc8ECAAAAAHQBAAAwAkAINEEAADBCQAg0gQCAAAAAdMEIAAAAAHUBCAAAAAB1gQAAADWBALXBAEAAAAB2AQBAAAAAdkEAQAAAAHaBAEAAAAB2wRAAAAAAQEgAACVBgAgFa4EQAAAAAGvBEAAAAAByAQBAAAAAckEAQAAAAHKBAEAAAABywQCAAAAAcwEAgAAAAHNBAIAAAABzgQCAAAAAc8ECAAAAAHQBAAAwAkAINEEAADBCQAg0gQCAAAAAdMEIAAAAAHUBCAAAAAB1gQAAADWBALXBAEAAAAB2AQBAAAAAdkEAQAAAAHaBAEAAAAB2wRAAAAAAQEgAACXBgAwASAAAJcGADABAAAADAAgAQAAAAkAIBgDAAC9CQAgBQAAvwkAIA0AAL4JACCuBEAA3ggAIa8EQADeCAAhyAQBANsIACHJBAEA2wgAIcoEAQDbCAAhywQCANwIACHMBAIA3AgAIc0EAgDcCAAhzgQCANwIACHPBAgAuQkAIdAEAAC6CQAg0QQAALsJACDSBAIA9ggAIdMEIACgCQAh1AQgAKAJACHWBAAAvAnWBCLXBAEA-QgAIdgEAQDbCAAh2QQBAPkIACHaBAEA-QgAIdsEQADmCAAhAgAAAB8AICAAAJwGACAVrgRAAN4IACGvBEAA3ggAIcgEAQDbCAAhyQQBANsIACHKBAEA2wgAIcsEAgDcCAAhzAQCANwIACHNBAIA3AgAIc4EAgDcCAAhzwQIALkJACHQBAAAugkAINEEAAC7CQAg0gQCAPYIACHTBCAAoAkAIdQEIACgCQAh1gQAALwJ1gQi1wQBAPkIACHYBAEA2wgAIdkEAQD5CAAh2gQBAPkIACHbBEAA5ggAIQIAAAAdACAgAACeBgAgAgAAAB0AICAAAJ4GACABAAAADAAgAQAAAAkAIAMAAAAfACAnAACVBgAgKAAAnAYAIAEAAAAfACABAAAAHQAgCgsAALQJACAtAAC3CQAgLgAAtgkAIE8AALUJACBQAAC4CQAg0gQAAN8IACDXBAAA3wgAINkEAADfCAAg2gQAAN8IACDbBAAA3wgAIBimBAAAmQcAMKcEAACnBgAQqAQAAJkHADCuBEAA9gYAIa8EQAD2BgAhyAQBAPIGACHJBAEA8wYAIcoEAQDzBgAhywQCAPQGACHMBAIA9AYAIc0EAgD0BgAhzgQCAPQGACHPBAgAmgcAIdAEAACbBwAg0QQAAJsHACDSBAIAnAcAIdMEIACdBwAh1AQgAJ0HACHWBAAAngfWBCLXBAEAnwcAIdgEAQDyBgAh2QQBAJ8HACHaBAEAnwcAIdsEQACKBwAhAwAAAB0AIAEAAKYGADAsAACnBgAgAwAAAB0AIAEAAB4AMAIAAB8AIAEAAAAwACABAAAAMAAgAwAAAC4AIAEAAC8AMAIAADAAIAMAAAAuACABAAAvADACAAAwACADAAAALgAgAQAALwAwAgAAMAAgBwMAALMJACAPAACyCQAgrgRAAAAAAa8EQAAAAAG8BAEAAAABxgQBAAAAAccEAQAAAAEBIAAArwYAIAWuBEAAAAABrwRAAAAAAbwEAQAAAAHGBAEAAAABxwQBAAAAAQEgAACxBgAwASAAALEGADAHAwAAsQkAIA8AALAJACCuBEAA3ggAIa8EQADeCAAhvAQBANsIACHGBAEA2wgAIccEAQDbCAAhAgAAADAAICAAALQGACAFrgRAAN4IACGvBEAA3ggAIbwEAQDbCAAhxgQBANsIACHHBAEA2wgAIQIAAAAuACAgAAC2BgAgAgAAAC4AICAAALYGACADAAAAMAAgJwAArwYAICgAALQGACABAAAAMAAgAQAAAC4AIAMLAACtCQAgLQAArwkAIC4AAK4JACAIpgQAAJgHADCnBAAAvQYAEKgEAACYBwAwrgRAAPYGACGvBEAA9gYAIbwEAQDyBgAhxgQBAPIGACHHBAEA8gYAIQMAAAAuACABAAC8BgAwLAAAvQYAIAMAAAAuACABAAAvADACAAAwACARAwAAlwcAIBYAAJMHACAXAACUBwAgGAAAlQcAIBkAAJYHACCmBAAAkAcAMKcEAABFABCoBAAAkAcAMK4EQACGBwAhrwRAAIYHACG7BAEAAAABvAQBAAAAAb0EAgCEBwAhvwQAAJEHvwQiwAQCAIQHACHBBAIAhAcAIcIEQACSBwAhAQAAAMAGACABAAAAwAYAIAYDAACsCQAgFgAAqAkAIBcAAKkJACAYAACqCQAgGQAAqwkAIMIEAADfCAAgAwAAAEUAIAEAAMMGADACAADABgAgAwAAAEUAIAEAAMMGADACAADABgAgAwAAAEUAIAEAAMMGADACAADABgAgDgMAAKcJACAWAACjCQAgFwAApAkAIBgAAKUJACAZAACmCQAgrgRAAAAAAa8EQAAAAAG7BAEAAAABvAQBAAAAAb0EAgAAAAG_BAAAAL8EAsAEAgAAAAHBBAIAAAABwgRAAAAAAQEgAADHBgAgCa4EQAAAAAGvBEAAAAABuwQBAAAAAbwEAQAAAAG9BAIAAAABvwQAAAC_BALABAIAAAABwQQCAAAAAcIEQAAAAAEBIAAAyQYAMAEgAADJBgAwDgMAAOsIACAWAADnCAAgFwAA6AgAIBgAAOkIACAZAADqCAAgrgRAAN4IACGvBEAA3ggAIbsEAQDbCAAhvAQBANsIACG9BAIA3AgAIb8EAADlCL8EIsAEAgDcCAAhwQQCANwIACHCBEAA5ggAIQIAAADABgAgIAAAzAYAIAmuBEAA3ggAIa8EQADeCAAhuwQBANsIACG8BAEA2wgAIb0EAgDcCAAhvwQAAOUIvwQiwAQCANwIACHBBAIA3AgAIcIEQADmCAAhAgAAAEUAICAAAM4GACACAAAARQAgIAAAzgYAIAMAAADABgAgJwAAxwYAICgAAMwGACABAAAAwAYAIAEAAABFACAGCwAA4AgAIC0AAOMIACAuAADiCAAgTwAA4QgAIFAAAOQIACDCBAAA3wgAIAymBAAAiAcAMKcEAADVBgAQqAQAAIgHADCuBEAA9gYAIa8EQAD2BgAhuwQBAPIGACG8BAEA8gYAIb0EAgD0BgAhvwQAAIkHvwQiwAQCAPQGACHBBAIA9AYAIcIEQACKBwAhAwAAAEUAIAEAANQGADAsAADVBgAgAwAAAEUAIAEAAMMGADACAADABgAgCwYBAIMHACGmBAAAgQcAMKcEAADbBgAQqAQAAIEHADCpBAEAAAABqgQCAIQHACGrBAEAgwcAIawEEACFBwAhrQQBAIMHACGuBEAAhgcAIa8EQACGBwAhAQAAANgGACABAAAA2AYAIAsGAQCDBwAhpgQAAIEHADCnBAAA2wYAEKgEAACBBwAwqQQBAIIHACGqBAIAhAcAIasEAQCDBwAhrAQQAIUHACGtBAEAgwcAIa4EQACGBwAhrwRAAIYHACEAAwAAANsGACABAADcBgAwAgAA2AYAIAMAAADbBgAgAQAA3AYAMAIAANgGACADAAAA2wYAIAEAANwGADACAADYBgAgCAYBAAAAAakEAQAAAAGqBAIAAAABqwQBAAAAAawEEAAAAAGtBAEAAAABrgRAAAAAAa8EQAAAAAEBIAAA4AYAIAgGAQAAAAGpBAEAAAABqgQCAAAAAasEAQAAAAGsBBAAAAABrQQBAAAAAa4EQAAAAAGvBEAAAAABASAAAOIGADABIAAA4gYAMAgGAQDbCAAhqQQBANsIACGqBAIA3AgAIasEAQDbCAAhrAQQAN0IACGtBAEA2wgAIa4EQADeCAAhrwRAAN4IACECAAAA2AYAICAAAOUGACAIBgEA2wgAIakEAQDbCAAhqgQCANwIACGrBAEA2wgAIawEEADdCAAhrQQBANsIACGuBEAA3ggAIa8EQADeCAAhAgAAANsGACAgAADnBgAgAgAAANsGACAgAADnBgAgAwAAANgGACAnAADgBgAgKAAA5QYAIAEAAADYBgAgAQAAANsGACAFCwAA1ggAIC0AANkIACAuAADYCAAgTwAA1wgAIFAAANoIACALBgEA8wYAIaYEAADxBgAwpwQAAO4GABCoBAAA8QYAMKkEAQDyBgAhqgQCAPQGACGrBAEA8wYAIawEEAD1BgAhrQQBAPMGACGuBEAA9gYAIa8EQAD2BgAhAwAAANsGACABAADtBgAwLAAA7gYAIAMAAADbBgAgAQAA3AYAMAIAANgGACALBgEA8wYAIaYEAADxBgAwpwQAAO4GABCoBAAA8QYAMKkEAQDyBgAhqgQCAPQGACGrBAEA8wYAIawEEAD1BgAhrQQBAPMGACGuBEAA9gYAIa8EQAD2BgAhCwsAAPgGACAtAAD_BgAgLgAA_wYAILAEAQAAAAGxBAEAAAAEsgQBAAAABLMEAQAAAAG0BAEAAAABtQQBAAAAAbYEAQAAAAG3BAEAgAcAIQ4LAAD4BgAgLQAA_wYAIC4AAP8GACCwBAEAAAABsQQBAAAABLIEAQAAAASzBAEAAAABtAQBAAAAAbUEAQAAAAG2BAEAAAABtwQBAP4GACG4BAEAAAABuQQBAAAAAboEAQAAAAENCwAA-AYAIC0AAPgGACAuAAD4BgAgTwAA_QYAIFAAAPgGACCwBAIAAAABsQQCAAAABLIEAgAAAASzBAIAAAABtAQCAAAAAbUEAgAAAAG2BAIAAAABtwQCAPwGACENCwAA-AYAIC0AAPsGACAuAAD7BgAgTwAA-wYAIFAAAPsGACCwBBAAAAABsQQQAAAABLIEEAAAAASzBBAAAAABtAQQAAAAAbUEEAAAAAG2BBAAAAABtwQQAPoGACELCwAA-AYAIC0AAPkGACAuAAD5BgAgsARAAAAAAbEEQAAAAASyBEAAAAAEswRAAAAAAbQEQAAAAAG1BEAAAAABtgRAAAAAAbcEQAD3BgAhCwsAAPgGACAtAAD5BgAgLgAA-QYAILAEQAAAAAGxBEAAAAAEsgRAAAAABLMEQAAAAAG0BEAAAAABtQRAAAAAAbYEQAAAAAG3BEAA9wYAIQiwBAIAAAABsQQCAAAABLIEAgAAAASzBAIAAAABtAQCAAAAAbUEAgAAAAG2BAIAAAABtwQCAPgGACEIsARAAAAAAbEEQAAAAASyBEAAAAAEswRAAAAAAbQEQAAAAAG1BEAAAAABtgRAAAAAAbcEQAD5BgAhDQsAAPgGACAtAAD7BgAgLgAA-wYAIE8AAPsGACBQAAD7BgAgsAQQAAAAAbEEEAAAAASyBBAAAAAEswQQAAAAAbQEEAAAAAG1BBAAAAABtgQQAAAAAbcEEAD6BgAhCLAEEAAAAAGxBBAAAAAEsgQQAAAABLMEEAAAAAG0BBAAAAABtQQQAAAAAbYEEAAAAAG3BBAA-wYAIQ0LAAD4BgAgLQAA-AYAIC4AAPgGACBPAAD9BgAgUAAA-AYAILAEAgAAAAGxBAIAAAAEsgQCAAAABLMEAgAAAAG0BAIAAAABtQQCAAAAAbYEAgAAAAG3BAIA_AYAIQiwBAgAAAABsQQIAAAABLIECAAAAASzBAgAAAABtAQIAAAAAbUECAAAAAG2BAgAAAABtwQIAP0GACEOCwAA-AYAIC0AAP8GACAuAAD_BgAgsAQBAAAAAbEEAQAAAASyBAEAAAAEswQBAAAAAbQEAQAAAAG1BAEAAAABtgQBAAAAAbcEAQD-BgAhuAQBAAAAAbkEAQAAAAG6BAEAAAABC7AEAQAAAAGxBAEAAAAEsgQBAAAABLMEAQAAAAG0BAEAAAABtQQBAAAAAbYEAQAAAAG3BAEA_wYAIbgEAQAAAAG5BAEAAAABugQBAAAAAQsLAAD4BgAgLQAA_wYAIC4AAP8GACCwBAEAAAABsQQBAAAABLIEAQAAAASzBAEAAAABtAQBAAAAAbUEAQAAAAG2BAEAAAABtwQBAIAHACELBgEAgwcAIaYEAACBBwAwpwQAANsGABCoBAAAgQcAMKkEAQCCBwAhqgQCAIQHACGrBAEAgwcAIawEEACFBwAhrQQBAIMHACGuBEAAhgcAIa8EQACGBwAhCLAEAQAAAAGxBAEAAAAEsgQBAAAABLMEAQAAAAG0BAEAAAABtQQBAAAAAbYEAQAAAAG3BAEAhwcAIQuwBAEAAAABsQQBAAAABLIEAQAAAASzBAEAAAABtAQBAAAAAbUEAQAAAAG2BAEAAAABtwQBAP8GACG4BAEAAAABuQQBAAAAAboEAQAAAAEIsAQCAAAAAbEEAgAAAASyBAIAAAAEswQCAAAAAbQEAgAAAAG1BAIAAAABtgQCAAAAAbcEAgD4BgAhCLAEEAAAAAGxBBAAAAAEsgQQAAAABLMEEAAAAAG0BBAAAAABtQQQAAAAAbYEEAAAAAG3BBAA-wYAIQiwBEAAAAABsQRAAAAABLIEQAAAAASzBEAAAAABtARAAAAAAbUEQAAAAAG2BEAAAAABtwRAAPkGACEIsAQBAAAAAbEEAQAAAASyBAEAAAAEswQBAAAAAbQEAQAAAAG1BAEAAAABtgQBAAAAAbcEAQCHBwAhDKYEAACIBwAwpwQAANUGABCoBAAAiAcAMK4EQAD2BgAhrwRAAPYGACG7BAEA8gYAIbwEAQDyBgAhvQQCAPQGACG_BAAAiQe_BCLABAIA9AYAIcEEAgD0BgAhwgRAAIoHACEHCwAA-AYAIC0AAI8HACAuAACPBwAgsAQAAAC_BAKxBAAAAL8ECLIEAAAAvwQItwQAAI4HvwQiCwsAAIwHACAtAACNBwAgLgAAjQcAILAEQAAAAAGxBEAAAAAFsgRAAAAABbMEQAAAAAG0BEAAAAABtQRAAAAAAbYEQAAAAAG3BEAAiwcAIQsLAACMBwAgLQAAjQcAIC4AAI0HACCwBEAAAAABsQRAAAAABbIEQAAAAAWzBEAAAAABtARAAAAAAbUEQAAAAAG2BEAAAAABtwRAAIsHACEIsAQCAAAAAbEEAgAAAAWyBAIAAAAFswQCAAAAAbQEAgAAAAG1BAIAAAABtgQCAAAAAbcEAgCMBwAhCLAEQAAAAAGxBEAAAAAFsgRAAAAABbMEQAAAAAG0BEAAAAABtQRAAAAAAbYEQAAAAAG3BEAAjQcAIQcLAAD4BgAgLQAAjwcAIC4AAI8HACCwBAAAAL8EArEEAAAAvwQIsgQAAAC_BAi3BAAAjge_BCIEsAQAAAC_BAKxBAAAAL8ECLIEAAAAvwQItwQAAI8HvwQiEQMAAJcHACAWAACTBwAgFwAAlAcAIBgAAJUHACAZAACWBwAgpgQAAJAHADCnBAAARQAQqAQAAJAHADCuBEAAhgcAIa8EQACGBwAhuwQBAIIHACG8BAEAggcAIb0EAgCEBwAhvwQAAJEHvwQiwAQCAIQHACHBBAIAhAcAIcIEQACSBwAhBLAEAAAAvwQCsQQAAAC_BAiyBAAAAL8ECLcEAACPB78EIgiwBEAAAAABsQRAAAAABbIEQAAAAAWzBEAAAAABtARAAAAAAbUEQAAAAAG2BEAAAAABtwRAAI0HACEDwwQAAEcAIMQEAABHACDFBAAARwAgA8MEAABLACDEBAAASwAgxQQAAEsAIAPDBAAATwAgxAQAAE8AIMUEAABPACADwwQAAFMAIMQEAABTACDFBAAAUwAgIwQAAMwIACAKAADKCAAgDAAAlggAIA4AAJcIACAPAADNCAAgEQAAvQgAIBIAANAIACAUAACbCAAgFQAA0QgAIBoAANIIACCmBAAAzggAMKcEAAAHABCoBAAAzggAMJAFAQCDBwAhxAUBAIIHACHKBUAAhgcAIcsFQACGBwAh7wUBAM0HACH6BQEAgwcAIfsFAQCDBwAh_AUBAM0HACH9BQEAzQcAIf4FAQDNBwAh_wUgAMwHACGABiAAzAcAIYIGAADPCIIGIoMGAQDNBwAhhAZAAJIHACGFBkAAkgcAIYYGAQDNBwAhhwYBAM0HACGIBkAAkgcAIYkGQACSBwAhjAYAAAcAII0GAAAHACAIpgQAAJgHADCnBAAAvQYAEKgEAACYBwAwrgRAAPYGACGvBEAA9gYAIbwEAQDyBgAhxgQBAPIGACHHBAEA8gYAIRimBAAAmQcAMKcEAACnBgAQqAQAAJkHADCuBEAA9gYAIa8EQAD2BgAhyAQBAPIGACHJBAEA8wYAIcoEAQDzBgAhywQCAPQGACHMBAIA9AYAIc0EAgD0BgAhzgQCAPQGACHPBAgAmgcAIdAEAACbBwAg0QQAAJsHACDSBAIAnAcAIdMEIACdBwAh1AQgAJ0HACHWBAAAngfWBCLXBAEAnwcAIdgEAQDyBgAh2QQBAJ8HACHaBAEAnwcAIdsEQACKBwAhDQsAAPgGACAtAAD9BgAgLgAA_QYAIE8AAP0GACBQAAD9BgAgsAQIAAAAAbEECAAAAASyBAgAAAAEswQIAAAAAbQECAAAAAG1BAgAAAABtgQIAAAAAbcECACoBwAhBLAEAQAAAAXcBAEAAAAB3QQBAAAABN4EAQAAAAQNCwAAjAcAIC0AAIwHACAuAACMBwAgTwAApwcAIFAAAIwHACCwBAIAAAABsQQCAAAABbIEAgAAAAWzBAIAAAABtAQCAAAAAbUEAgAAAAG2BAIAAAABtwQCAKYHACEFCwAA-AYAIC0AAKUHACAuAAClBwAgsAQgAAAAAbcEIACkBwAhBwsAAPgGACAtAACjBwAgLgAAowcAILAEAAAA1gQCsQQAAADWBAiyBAAAANYECLcEAACiB9YEIg4LAACMBwAgLQAAoQcAIC4AAKEHACCwBAEAAAABsQQBAAAABbIEAQAAAAWzBAEAAAABtAQBAAAAAbUEAQAAAAG2BAEAAAABtwQBAKAHACG4BAEAAAABuQQBAAAAAboEAQAAAAEOCwAAjAcAIC0AAKEHACAuAAChBwAgsAQBAAAAAbEEAQAAAAWyBAEAAAAFswQBAAAAAbQEAQAAAAG1BAEAAAABtgQBAAAAAbcEAQCgBwAhuAQBAAAAAbkEAQAAAAG6BAEAAAABC7AEAQAAAAGxBAEAAAAFsgQBAAAABbMEAQAAAAG0BAEAAAABtQQBAAAAAbYEAQAAAAG3BAEAoQcAIbgEAQAAAAG5BAEAAAABugQBAAAAAQcLAAD4BgAgLQAAowcAIC4AAKMHACCwBAAAANYEArEEAAAA1gQIsgQAAADWBAi3BAAAogfWBCIEsAQAAADWBAKxBAAAANYECLIEAAAA1gQItwQAAKMH1gQiBQsAAPgGACAtAAClBwAgLgAApQcAILAEIAAAAAG3BCAApAcAIQKwBCAAAAABtwQgAKUHACENCwAAjAcAIC0AAIwHACAuAACMBwAgTwAApwcAIFAAAIwHACCwBAIAAAABsQQCAAAABbIEAgAAAAWzBAIAAAABtAQCAAAAAbUEAgAAAAG2BAIAAAABtwQCAKYHACEIsAQIAAAAAbEECAAAAAWyBAgAAAAFswQIAAAAAbQECAAAAAG1BAgAAAABtgQIAAAAAbcECACnBwAhDQsAAPgGACAtAAD9BgAgLgAA_QYAIE8AAP0GACBQAAD9BgAgsAQIAAAAAbEECAAAAASyBAgAAAAEswQIAAAAAbQECAAAAAG1BAgAAAABtgQIAAAAAbcECACoBwAhCwcBAPMGACGmBAAAqQcAMKcEAACNBgAQqAQAAKkHADCtBAEA8wYAIa4EQAD2BgAhrwRAAPYGACHfBAEA8gYAIeAEAQDzBgAh4QQQAPUGACHiBEAA9gYAIQsHAQCDBwAhpgQAAKoHADCnBAAA-gUAEKgEAACqBwAwrQQBAIMHACGuBEAAhgcAIa8EQACGBwAh3wQBAIIHACHgBAEAgwcAIeEEEACFBwAh4gRAAIYHACEKBwEA8wYAIaYEAACrBwAwpwQAAPQFABCoBAAAqwcAMK0EAQDzBgAhrgRAAPYGACGvBEAA9gYAIeIEQAD2BgAh4wQBAPIGACHkBBAA9QYAIQoHAQCDBwAhpgQAAKwHADCnBAAA4QUAEKgEAACsBwAwrQQBAIMHACGuBEAAhgcAIa8EQACGBwAh4gRAAIYHACHjBAEAggcAIeQEEACFBwAhEwcBAPMGACGmBAAArQcAMKcEAADbBQAQqAQAAK0HADCuBEAA9gYAIa8EQAD2BgAhuwQBAPIGACHgBAEA8wYAIeUEAQDyBgAh5gQCAPQGACHnBAIA9AYAIegEAgCcBwAh6QQCAJwHACHrBAAArgfrBCLsBBAArwcAIe0EEACvBwAh7gRAAIoHACHvBAEAnwcAIfAEAgD0BgAhBwsAAPgGACAtAACzBwAgLgAAswcAILAEAAAA6wQCsQQAAADrBAiyBAAAAOsECLcEAACyB-sEIg0LAACMBwAgLQAAsQcAIC4AALEHACBPAACxBwAgUAAAsQcAILAEEAAAAAGxBBAAAAAFsgQQAAAABbMEEAAAAAG0BBAAAAABtQQQAAAAAbYEEAAAAAG3BBAAsAcAIQ0LAACMBwAgLQAAsQcAIC4AALEHACBPAACxBwAgUAAAsQcAILAEEAAAAAGxBBAAAAAFsgQQAAAABbMEEAAAAAG0BBAAAAABtQQQAAAAAbYEEAAAAAG3BBAAsAcAIQiwBBAAAAABsQQQAAAABbIEEAAAAAWzBBAAAAABtAQQAAAAAbUEEAAAAAG2BBAAAAABtwQQALEHACEHCwAA-AYAIC0AALMHACAuAACzBwAgsAQAAADrBAKxBAAAAOsECLIEAAAA6wQItwQAALIH6wQiBLAEAAAA6wQCsQQAAADrBAiyBAAAAOsECLcEAACzB-sEIgqmBAAAtAcAMKcEAADFBQAQqAQAALQHADCuBEAA9gYAIa8EQAD2BgAhxwQBAPIGACHxBAEA8gYAIfIEAQDzBgAh8wQBAJ8HACH0BAIA9AYAISCmBAAAtQcAMKcEAACvBQAQqAQAALUHADCuBEAA9gYAIa8EQAD2BgAhxwQBAPIGACHJBAEA8wYAIdQEIACdBwAh1gQAALwHjQUi2QQBAPMGACHmBAIA9AYAIecEAgD0BgAh9QQBAPMGACH3BAAAtgf3BCL5BAAAtwf5BCL6BBAA9QYAIfwEAAC4B_wEIv0EAgCcBwAh_wQAALkH_wQigAUBAPMGACGBBQgAugcAIYIFCAC6BwAhgwUAAJsHACCEBUAAigcAIYUFAQCfBwAhhgUQAK8HACGIBQAAuweIBSKJBQEAnwcAIYoFAQCfBwAhiwUgAJ0HACGNBQIA9AYAIY4FAQDyBgAhBwsAAPgGACAtAADJBwAgLgAAyQcAILAEAAAA9wQCsQQAAAD3BAiyBAAAAPcECLcEAADIB_cEIgcLAAD4BgAgLQAAxwcAIC4AAMcHACCwBAAAAPkEArEEAAAA-QQIsgQAAAD5BAi3BAAAxgf5BCIHCwAA-AYAIC0AAMUHACAuAADFBwAgsAQAAAD8BAKxBAAAAPwECLIEAAAA_AQItwQAAMQH_AQiBwsAAPgGACAtAADDBwAgLgAAwwcAILAEAAAA_wQCsQQAAAD_BAiyBAAAAP8ECLcEAADCB_8EIg0LAACMBwAgLQAApwcAIC4AAKcHACBPAACnBwAgUAAApwcAILAECAAAAAGxBAgAAAAFsgQIAAAABbMECAAAAAG0BAgAAAABtQQIAAAAAbYECAAAAAG3BAgAwQcAIQcLAAD4BgAgLQAAwAcAIC4AAMAHACCwBAAAAIgFArEEAAAAiAUIsgQAAACIBQi3BAAAvweIBSIHCwAA-AYAIC0AAL4HACAuAAC-BwAgsAQAAACNBQKxBAAAAI0FCLIEAAAAjQUItwQAAL0HjQUiBwsAAPgGACAtAAC-BwAgLgAAvgcAILAEAAAAjQUCsQQAAACNBQiyBAAAAI0FCLcEAAC9B40FIgSwBAAAAI0FArEEAAAAjQUIsgQAAACNBQi3BAAAvgeNBSIHCwAA-AYAIC0AAMAHACAuAADABwAgsAQAAACIBQKxBAAAAIgFCLIEAAAAiAUItwQAAL8HiAUiBLAEAAAAiAUCsQQAAACIBQiyBAAAAIgFCLcEAADAB4gFIg0LAACMBwAgLQAApwcAIC4AAKcHACBPAACnBwAgUAAApwcAILAECAAAAAGxBAgAAAAFsgQIAAAABbMECAAAAAG0BAgAAAABtQQIAAAAAbYECAAAAAG3BAgAwQcAIQcLAAD4BgAgLQAAwwcAIC4AAMMHACCwBAAAAP8EArEEAAAA_wQIsgQAAAD_BAi3BAAAwgf_BCIEsAQAAAD_BAKxBAAAAP8ECLIEAAAA_wQItwQAAMMH_wQiBwsAAPgGACAtAADFBwAgLgAAxQcAILAEAAAA_AQCsQQAAAD8BAiyBAAAAPwECLcEAADEB_wEIgSwBAAAAPwEArEEAAAA_AQIsgQAAAD8BAi3BAAAxQf8BCIHCwAA-AYAIC0AAMcHACAuAADHBwAgsAQAAAD5BAKxBAAAAPkECLIEAAAA-QQItwQAAMYH-QQiBLAEAAAA-QQCsQQAAAD5BAiyBAAAAPkECLcEAADHB_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_wcAIC4AAP8HACCwBAAAAMgFArEEAAAAyAUIsgQAAADIBQi3BAAA_gfIBSIHCwAA-AYAIC0AAP8HACAuAAD_BwAgsAQAAADIBQKxBAAAAMgFCLIEAAAAyAUItwQAAP4HyAUiBLAEAAAAyAUCsQQAAADIBQiyBAAAAMgFCLcEAAD_B8gFIg0IAACXBwAgpgQAAIAIADCnBAAAXQAQqAQAAIAIADDWBAAAgQjIBSLDBQEAggcAIcQFAQCCBwAhxQUBAM0HACHGBQEAgwcAIcgFQACSBwAhyQUgAMwHACHKBUAAhgcAIcsFQACGBwAhBLAEAAAAyAUCsQQAAADIBQiyBAAAAMgFCLcEAAD_B8gFIgemBAAAgggAMKcEAADUAgAQqAQAAIIIADDWBAEA8wYAIcwFAQDzBgAhzQUBAPMGACHOBUAA9gYAIQemBAAAgwgAMKcEAADBAgAQqAQAAIMIADDWBAEAgwcAIcwFAQCDBwAhzQUBAIMHACHOBUAAhgcAIQ6mBAAAhAgAMKcEAAC7AgAQqAQAAIQIADDWBAAAhQjVBSKrBQIA9AYAIcQFAQDyBgAhygVAAPYGACHLBUAA9gYAIc8FAQDyBgAh0AUBAPMGACHRBQEAnwcAIdIFAQCfBwAh0wUBAPMGACHVBUAAigcAIQcLAAD4BgAgLQAAhwgAIC4AAIcIACCwBAAAANUFArEEAAAA1QUIsgQAAADVBQi3BAAAhgjVBSIHCwAA-AYAIC0AAIcIACAuAACHCAAgsAQAAADVBQKxBAAAANUFCLIEAAAA1QUItwQAAIYI1QUiBLAEAAAA1QUCsQQAAADVBQiyBAAAANUFCLcEAACHCNUFIhOmBAAAiAgAMKcEAAClAgAQqAQAAIgIADDWBAAAiQjZBSL1BAEAnwcAIa8FAQCfBwAhxAUBANMHACHKBUAA9gYAIcsFQAD2BgAh0AUBAPMGACHWBQEAnwcAIdcFAQCfBwAh2QUIALoHACHaBQgAugcAIdsFCAC6BwAh3AUAAIoIACDdBQAAiggAIN4FAQCfBwAh3wVAAIoHACEHCwAA-AYAIC0AAI0IACAuAACNCAAgsAQAAADZBQKxBAAAANkFCLIEAAAA2QUItwQAAIwI2QUiDwsAAIwHACAtAACLCAAgLgAAiwgAILAEgAAAAAGzBIAAAAABtASAAAAAAbUEgAAAAAG2BIAAAAABtwSAAAAAAeAFAQAAAAHhBQEAAAAB4gUBAAAAAeMFgAAAAAHkBYAAAAAB5QWAAAAAAQywBIAAAAABswSAAAAAAbQEgAAAAAG1BIAAAAABtgSAAAAAAbcEgAAAAAHgBQEAAAAB4QUBAAAAAeIFAQAAAAHjBYAAAAAB5AWAAAAAAeUFgAAAAAEHCwAA-AYAIC0AAI0IACAuAACNCAAgsAQAAADZBQKxBAAAANkFCLIEAAAA2QUItwQAAIwI2QUiBLAEAAAA2QUCsQQAAADZBQiyBAAAANkFCLcEAACNCNkFIg6mBAAAjggAMKcEAACJAgAQqAQAAI4IADCBBQgAugcAIYIFCAC6BwAhygVAAPYGACHLBUAA9gYAIdYFAQCfBwAh1wUBAPMGACHmBQEA8wYAIecFAQDzBgAh6AUBAPMGACHpBQEAnwcAIeoFAACPCAAgDwsAAPgGACAtAACQCAAgLgAAkAgAILAEgAAAAAGzBIAAAAABtASAAAAAAbUEgAAAAAG2BIAAAAABtwSAAAAAAeAFAQAAAAHhBQEAAAAB4gUBAAAAAeMFgAAAAAHkBYAAAAAB5QWAAAAAAQywBIAAAAABswSAAAAAAbQEgAAAAAG1BIAAAAABtgSAAAAAAbcEgAAAAAHgBQEAAAAB4QUBAAAAAeIFAQAAAAHjBYAAAAAB5AWAAAAAAeUFgAAAAAENpgQAAJEIADCnBAAA8QEAEKgEAACRCAAw9QQBAJ8HACGBBQgAugcAIYIFCAC6BwAhrwUBAPMGACG0BQEA8wYAIcoFQAD2BgAhywVAAPYGACHWBQEA8wYAIeoFAACPCAAg6wUBAJ8HACEQBQAAlQgAIAwAAJYIACAOAACXCAAgpgQAAJIIADCnBAAADAAQqAQAAJIIADD1BAEAzQcAIYEFCACTCAAhggUIAJMIACGvBQEAgwcAIbQFAQCDBwAhygVAAIYHACHLBUAAhgcAIdYFAQCDBwAh6gUAAJQIACDrBQEAzQcAIQiwBAgAAAABsQQIAAAABbIECAAAAAWzBAgAAAABtAQIAAAAAbUECAAAAAG2BAgAAAABtwQIAKcHACEMsASAAAAAAbMEgAAAAAG0BIAAAAABtQSAAAAAAbYEgAAAAAG3BIAAAAAB4AUBAAAAAeEFAQAAAAHiBQEAAAAB4wWAAAAAAeQFgAAAAAHlBYAAAAABA8MEAAAJACDEBAAACQAgxQQAAAkAIAPDBAAAEQAgxAQAABEAIMUEAAARACADwwQAAB0AIMQEAAAdACDFBAAAHQAgCaYEAACYCAAwpwQAANkBABCoBAAAmAgAMMQFAQDyBgAhygVAAPYGACHLBUAA9gYAIewFAQDyBgAh7QUBAPIGACHuBSAAnQcAIQymBAAAmQgAMKcEAADDAQAQqAQAAJkIADD1BAEAnwcAIZAFAQCfBwAhrwUBAPMGACHKBUAA9gYAIcsFQAD2BgAh7QUBAPIGACHuBSAAnQcAIe8FAQCfBwAh8AUBAJ8HACENAwAAmwgAIKYEAACaCAAwpwQAALABABCoBAAAmggAMPUEAQDNBwAhkAUBAM0HACGvBQEAgwcAIcoFQACGBwAhywVAAIYHACHtBQEAggcAIe4FIADMBwAh7wUBAM0HACHwBQEAzQcAIQPDBAAAPwAgxAQAAD8AIMUEAAA_ACALpgQAAJwIADCnBAAAqgEAEKgEAACcCAAwxAUBAPIGACHKBUAA9gYAIcsFQAD2BgAh8QUCAPQGACHyBQEA0wcAIfMFQACKBwAh9AUBANMHACH1BUAAigcAIQwDAACXBwAgpgQAAJ0IADCnBAAAPQAQqAQAAJ0IADDEBQEAggcAIcoFQACGBwAhywVAAIYHACHxBQIAhAcAIfIFAQD3BwAh8wVAAJIHACH0BQEA9wcAIfUFQACSBwAhCaYEAACeCAAwpwQAAJIBABCoBAAAnggAMMoFQAD2BgAhzAUBAPIGACH2BQEA8wYAIfcFAQDyBgAh-AUBAPMGACH5BQEAnwcAIQmmBAAAnwgAMKcEAAB_ABCoBAAAnwgAMMoFQACGBwAhzAUBAIIHACH2BQEAgwcAIfcFAQCCBwAh-AUBAIMHACH5BQEAzQcAIRemBAAAoAgAMKcEAAB5ABCoBAAAoAgAMJAFAQDzBgAhxAUBAPIGACHKBUAA9gYAIcsFQAD2BgAh7wUBAJ8HACH6BQEA8wYAIfsFAQDzBgAh_AUBAJ8HACH9BQEAnwcAIf4FAQCfBwAh_wUgAJ0HACGABiAAnQcAIYIGAAChCIIGIoMGAQCfBwAhhAZAAIoHACGFBkAAigcAIYYGAQCfBwAhhwYBAJ8HACGIBkAAigcAIYkGQACKBwAhBwsAAPgGACAtAACjCAAgLgAAowgAILAEAAAAggYCsQQAAACCBgiyBAAAAIIGCLcEAACiCIIGIgcLAAD4BgAgLQAAowgAIC4AAKMIACCwBAAAAIIGArEEAAAAggYIsgQAAACCBgi3BAAAogiCBiIEsAQAAACCBgKxBAAAAIIGCLIEAAAAggYItwQAAKMIggYiFAcBAIMHACEVAACnCAAgpgQAAKQIADCnBAAAUwAQqAQAAKQIADCuBEAAhgcAIa8EQACGBwAhuwQBAIIHACHgBAEAgwcAIeUEAQCCBwAh5gQCAIQHACHnBAIAhAcAIegEAgD1BwAh6QQCAPUHACHrBAAApQjrBCLsBBAApggAIe0EEACmCAAh7gRAAJIHACHvBAEAzQcAIfAEAgCEBwAhBLAEAAAA6wQCsQQAAADrBAiyBAAAAOsECLcEAACzB-sEIgiwBBAAAAABsQQQAAAABbIEEAAAAAWzBBAAAAABtAQQAAAAAbUEEAAAAAG2BBAAAAABtwQQALEHACETAwAAlwcAIBYAAJMHACAXAACUBwAgGAAAlQcAIBkAAJYHACCmBAAAkAcAMKcEAABFABCoBAAAkAcAMK4EQACGBwAhrwRAAIYHACG7BAEAggcAIbwEAQCCBwAhvQQCAIQHACG_BAAAkQe_BCLABAIAhAcAIcEEAgCEBwAhwgRAAJIHACGMBgAARQAgjQYAAEUAIA0GAQDNBwAhBwEAzQcAIRUAAKcIACCmBAAAqAgAMKcEAABPABCoBAAAqAgAMK4EQACGBwAhrwRAAIYHACG7BAEAggcAIfAEAgCEBwAhoQUBAIIHACGjBQAAqQijBSKkBQEAgwcAIQSwBAAAAKMFArEEAAAAowUIsgQAAACjBQi3BAAA3AejBSIMFQAApwgAIKYEAACqCAAwpwQAAEsAEKgEAACqCAAwrgRAAIYHACGvBEAAhgcAIbsEAQCCBwAh9QQBAIMHACH3BAAAqwitBSKqBQEAggcAIasFAgCEBwAhrQUCAIQHACEEsAQAAACtBQKxBAAAAK0FCLIEAAAArQUItwQAAOQHrQUiDwYBAM0HACEHAQDNBwAhFQAApwgAIKYEAACsCAAwpwQAAEcAEKgEAACsCAAwrgRAAIYHACGvBEAAhgcAIbsEAQCCBwAh8AQCAIQHACG-BQEAggcAIb8FAQCDBwAhwAUBAIMHACHBBQIA9QcAIcIFIADMBwAhAsQFAQAAAAHtBQEAAAABCwgAAJcHACATAACvCAAgpgQAAK4IADCnBAAAPwAQqAQAAK4IADDEBQEAggcAIcoFQACGBwAhywVAAIYHACHsBQEAggcAIe0FAQCCBwAh7gUgAMwHACEPAwAAmwgAIKYEAACaCAAwpwQAALABABCoBAAAmggAMPUEAQDNBwAhkAUBAM0HACGvBQEAgwcAIcoFQACGBwAhywVAAIYHACHtBQEAggcAIe4FIADMBwAh7wUBAM0HACHwBQEAzQcAIYwGAACwAQAgjQYAALABACACvAQBAAAAAccEAQAAAAEKAwAAlwcAIA8AALIIACCmBAAAsQgAMKcEAAAuABCoBAAAsQgAMK4EQACGBwAhrwRAAIYHACG8BAEAggcAIcYEAQCCBwAhxwQBAIIHACEmAwAAlwcAIAUAALsIACAQAAC8CAAgEQAAvQgAIKYEAAC0CAAwpwQAACYAEKgEAAC0CAAwrgRAAIYHACGvBEAAhgcAIccEAQCCBwAhyQQBAIMHACHUBCAAzAcAIdYEAAC6CI0FItkEAQCDBwAh5gQCAIQHACHnBAIAhAcAIfUEAQCDBwAh9wQAALUI9wQi-QQAALYI-QQi-gQQAIUHACH8BAAAtwj8BCL9BAIA9QcAIf8EAAC4CP8EIoAFAQCDBwAhgQUIAJMIACGCBQgAkwgAIYMFAACbBwAghAVAAJIHACGFBQEAzQcAIYYFEACmCAAhiAUAALkIiAUiiQUBAM0HACGKBQEAzQcAIYsFIADMBwAhjQUCAIQHACGOBQEAggcAIYwGAAAmACCNBgAAJgAgCw8AALIIACCmBAAAswgAMKcEAAAqABCoBAAAswgAMK4EQACGBwAhrwRAAIYHACHHBAEAggcAIfEEAQCCBwAh8gQBAIMHACHzBAEAzQcAIfQEAgCEBwAhJAMAAJcHACAFAAC7CAAgEAAAvAgAIBEAAL0IACCmBAAAtAgAMKcEAAAmABCoBAAAtAgAMK4EQACGBwAhrwRAAIYHACHHBAEAggcAIckEAQCDBwAh1AQgAMwHACHWBAAAugiNBSLZBAEAgwcAIeYEAgCEBwAh5wQCAIQHACH1BAEAgwcAIfcEAAC1CPcEIvkEAAC2CPkEIvoEEACFBwAh_AQAALcI_AQi_QQCAPUHACH_BAAAuAj_BCKABQEAgwcAIYEFCACTCAAhggUIAJMIACGDBQAAmwcAIIQFQACSBwAhhQUBAM0HACGGBRAApggAIYgFAAC5CIgFIokFAQDNBwAhigUBAM0HACGLBSAAzAcAIY0FAgCEBwAhjgUBAIIHACEEsAQAAAD3BAKxBAAAAPcECLIEAAAA9wQItwQAAMkH9wQiBLAEAAAA-QQCsQQAAAD5BAiyBAAAAPkECLcEAADHB_kEIgSwBAAAAPwEArEEAAAA_AQIsgQAAAD8BAi3BAAAxQf8BCIEsAQAAAD_BAKxBAAAAP8ECLIEAAAA_wQItwQAAMMH_wQiBLAEAAAAiAUCsQQAAACIBQiyBAAAAIgFCLcEAADAB4gFIgSwBAAAAI0FArEEAAAAjQUIsgQAAACNBQi3BAAAvgeNBSIVBAAAzAgAIAYAAMEIACAMAACWCAAgDgAAlwgAIA8AAM0IACCmBAAAywgAMKcEAAAJABCoBAAAywgAMIEFCACTCAAhggUIAJMIACHKBUAAhgcAIcsFQACGBwAh1gUBAM0HACHXBQEAgwcAIeYFAQCDBwAh5wUBAIMHACHoBQEAgwcAIekFAQDNBwAh6gUAAJQIACCMBgAACQAgjQYAAAkAIAPDBAAAKgAgxAQAACoAIMUEAAAqACADwwQAAC4AIMQEAAAuACDFBAAALgAgGwMAAJcHACAFAADCCAAgDQAAwQgAIKYEAAC-CAAwpwQAAB0AEKgEAAC-CAAwrgRAAIYHACGvBEAAhgcAIcgEAQCCBwAhyQQBAIMHACHKBAEAgwcAIcsEAgCEBwAhzAQCAIQHACHNBAIAhAcAIc4EAgCEBwAhzwQIAL8IACHQBAAAmwcAINEEAACbBwAg0gQCAPUHACHTBCAAzAcAIdQEIADMBwAh1gQAAMAI1gQi1wQBAM0HACHYBAEAggcAIdkEAQDNBwAh2gQBAM0HACHbBEAAkgcAIQiwBAgAAAABsQQIAAAABLIECAAAAASzBAgAAAABtAQIAAAAAbUECAAAAAG2BAgAAAABtwQIAP0GACEEsAQAAADWBAKxBAAAANYECLIEAAAA1gQItwQAAKMH1gQiEgUAAJUIACAMAACWCAAgDgAAlwgAIKYEAACSCAAwpwQAAAwAEKgEAACSCAAw9QQBAM0HACGBBQgAkwgAIYIFCACTCAAhrwUBAIMHACG0BQEAgwcAIcoFQACGBwAhywVAAIYHACHWBQEAgwcAIeoFAACUCAAg6wUBAM0HACGMBgAADAAgjQYAAAwAIBUEAADMCAAgBgAAwQgAIAwAAJYIACAOAACXCAAgDwAAzQgAIKYEAADLCAAwpwQAAAkAEKgEAADLCAAwgQUIAJMIACGCBQgAkwgAIcoFQACGBwAhywVAAIYHACHWBQEAzQcAIdcFAQCDBwAh5gUBAIMHACHnBQEAgwcAIegFAQCDBwAh6QUBAM0HACHqBQAAlAgAIIwGAAAJACCNBgAACQAgEAgAAJcHACAJAADFCAAgpgQAAMMIADCnBAAAGAAQqAQAAMMIADDWBAAAxAjVBSKrBQIAhAcAIcQFAQCCBwAhygVAAIYHACHLBUAAhgcAIc8FAQCCBwAh0AUBAIMHACHRBQEAzQcAIdIFAQDNBwAh0wUBAIMHACHVBUAAkgcAIQSwBAAAANUFArEEAAAA1QUIsgQAAADVBQi3BAAAhwjVBSIZBgAAwQgAIAcAAMIIACAIAADJCAAgCgAAyggAIKYEAADGCAAwpwQAABEAEKgEAADGCAAw1gQAAMcI2QUi9QQBAM0HACGvBQEAzQcAIcQFAQD3BwAhygVAAIYHACHLBUAAhgcAIdAFAQCDBwAh1gUBAM0HACHXBQEAzQcAIdkFCACTCAAh2gUIAJMIACHbBQgAkwgAIdwFAADICAAg3QUAAMgIACDeBQEAzQcAId8FQACSBwAhjAYAABEAII0GAAARACAXBgAAwQgAIAcAAMIIACAIAADJCAAgCgAAyggAIKYEAADGCAAwpwQAABEAEKgEAADGCAAw1gQAAMcI2QUi9QQBAM0HACGvBQEAzQcAIcQFAQD3BwAhygVAAIYHACHLBUAAhgcAIdAFAQCDBwAh1gUBAM0HACHXBQEAzQcAIdkFCACTCAAh2gUIAJMIACHbBQgAkwgAIdwFAADICAAg3QUAAMgIACDeBQEAzQcAId8FQACSBwAhBLAEAAAA2QUCsQQAAADZBQiyBAAAANkFCLcEAACNCNkFIgywBIAAAAABswSAAAAAAbQEgAAAAAG1BIAAAAABtgSAAAAAAbcEgAAAAAHgBQEAAAAB4QUBAAAAAeIFAQAAAAHjBYAAAAAB5AWAAAAAAeUFgAAAAAEjBAAAzAgAIAoAAMoIACAMAACWCAAgDgAAlwgAIA8AAM0IACARAAC9CAAgEgAA0AgAIBQAAJsIACAVAADRCAAgGgAA0ggAIKYEAADOCAAwpwQAAAcAEKgEAADOCAAwkAUBAIMHACHEBQEAggcAIcoFQACGBwAhywVAAIYHACHvBQEAzQcAIfoFAQCDBwAh-wUBAIMHACH8BQEAzQcAIf0FAQDNBwAh_gUBAM0HACH_BSAAzAcAIYAGIADMBwAhggYAAM8IggYigwYBAM0HACGEBkAAkgcAIYUGQACSBwAhhgYBAM0HACGHBgEAzQcAIYgGQACSBwAhiQZAAJIHACGMBgAABwAgjQYAAAcAIAPDBAAAGAAgxAQAABgAIMUEAAAYACATBAAAzAgAIAYAAMEIACAMAACWCAAgDgAAlwgAIA8AAM0IACCmBAAAywgAMKcEAAAJABCoBAAAywgAMIEFCACTCAAhggUIAJMIACHKBUAAhgcAIcsFQACGBwAh1gUBAM0HACHXBQEAgwcAIeYFAQCDBwAh5wUBAIMHACHoBQEAgwcAIekFAQDNBwAh6gUAAJQIACADwwQAAAMAIMQEAAADACDFBAAAAwAgA8MEAAAmACDEBAAAJgAgxQQAACYAICEEAADMCAAgCgAAyggAIAwAAJYIACAOAACXCAAgDwAAzQgAIBEAAL0IACASAADQCAAgFAAAmwgAIBUAANEIACAaAADSCAAgpgQAAM4IADCnBAAABwAQqAQAAM4IADCQBQEAgwcAIcQFAQCCBwAhygVAAIYHACHLBUAAhgcAIe8FAQDNBwAh-gUBAIMHACH7BQEAgwcAIfwFAQDNBwAh_QUBAM0HACH-BQEAzQcAIf8FIADMBwAhgAYgAMwHACGCBgAAzwiCBiKDBgEAzQcAIYQGQACSBwAhhQZAAJIHACGGBgEAzQcAIYcGAQDNBwAhiAZAAJIHACGJBkAAkgcAIQSwBAAAAIIGArEEAAAAggYIsgQAAACCBgi3BAAAowiCBiIOAwAAlwcAIKYEAACdCAAwpwQAAD0AEKgEAACdCAAwxAUBAIIHACHKBUAAhgcAIcsFQACGBwAh8QUCAIQHACHyBQEA9wcAIfMFQACSBwAh9AUBAPcHACH1BUAAkgcAIYwGAAA9ACCNBgAAPQAgEwMAAJcHACAWAACTBwAgFwAAlAcAIBgAAJUHACAZAACWBwAgpgQAAJAHADCnBAAARQAQqAQAAJAHADCuBEAAhgcAIa8EQACGBwAhuwQBAIIHACG8BAEAggcAIb0EAgCEBwAhvwQAAJEHvwQiwAQCAIQHACHBBAIAhAcAIcIEQACSBwAhjAYAAEUAII0GAABFACAPCAAAlwcAIKYEAACACAAwpwQAAF0AEKgEAACACAAw1gQAAIEIyAUiwwUBAIIHACHEBQEAggcAIcUFAQDNBwAhxgUBAIMHACHIBUAAkgcAIckFIADMBwAhygVAAIYHACHLBUAAhgcAIYwGAABdACCNBgAAXQAgFQMAAMkIACAFAADCCAAgpgQAANMIADCnBAAAAwAQqAQAANMIADCuBEAAhgcAIa8EQACGBwAhyQQBAIMHACHTBCAAzAcAIdYEAADVCKAFItgEAQD3BwAh2QQBAM0HACHbBEAAkgcAIfcEAADUCJoFIpgFAQCCBwAhmgUBAIMHACGbBQEAzQcAIZwFAQDNBwAhnQUCAPUHACGeBQEAzQcAIaAFAQDNBwAhBLAEAAAAmgUCsQQAAACaBQiyBAAAAJoFCLcEAADYB5oFIgSwBAAAAKAFArEEAAAAoAUIsgQAAACgBQi3BAAA1gegBSIAAAAAAAGRBgEAAAABBZEGAgAAAAGYBgIAAAABmQYCAAAAAZoGAgAAAAGbBgIAAAABBZEGEAAAAAGYBhAAAAABmQYQAAAAAZoGEAAAAAGbBhAAAAABAZEGQAAAAAEAAAAAAAABkQYAAAC_BAIBkQZAAAAAAQsnAACWCQAwKAAAmwkAMI4GAACXCQAwjwYAAJgJADCQBgAAmQkAIJEGAACaCQAwkgYAAJoJADCTBgAAmgkAMJQGAACaCQAwlQYAAJwJADCWBgAAnQkAMAsnAACJCQAwKAAAjgkAMI4GAACKCQAwjwYAAIsJADCQBgAAjAkAIJEGAACNCQAwkgYAAI0JADCTBgAAjQkAMJQGAACNCQAwlQYAAI8JADCWBgAAkAkAMAsnAAD8CAAwKAAAgQkAMI4GAAD9CAAwjwYAAP4IADCQBgAA_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_BQEAgwcAIcAFAQCDBwAhwQUCAPUHACHCBSAAzAcAIQ4GAQDNBwAhBwEAzQcAIaYEAACdCQAwpwQAAJ4JABCoBAAAnQkAMK4EQACGBwAhrwRAAIYHACG7BAEAggcAIfAEAgCEBwAhvgUBAIIHACG_BQEAgwcAIcAFAQCDBwAhwQUCAPUHACHCBSAAzAcAIQoGAQD5CAAhBwEA-QgAIa4EQADeCAAhrwRAAN4IACHwBAIA3AgAIb4FAQDbCAAhvwUBANsIACHABQEA2wgAIcEFAgD2CAAhwgUgAKAJACEBkQYgAAAAAQoGAQD5CAAhBwEA-QgAIa4EQADeCAAhrwRAAN4IACHwBAIA3AgAIb4FAQDbCAAhvwUBANsIACHABQEA2wgAIcEFAgD2CAAhwgUgAKAJACEKBgEAAAABBwEAAAABrgRAAAAAAa8EQAAAAAHwBAIAAAABvgUBAAAAAb8FAQAAAAHABQEAAAABwQUCAAAAAcIFIAAAAAEEJwAAlgkAMI4GAACXCQAwkAYAAJkJACCUBgAAmgkAMAQnAACJCQAwjgYAAIoJADCQBgAAjAkAIJQGAACNCQAwBCcAAPwIADCOBgAA_QgAMJAGAAD_CAAglAYAAIAJADAEJwAA7AgAMI4GAADtCAAwkAYAAO8IACCUBgAA8AgAMAMnAACzDgAgjgYAALQOACCUBgAAAQAgAAAAABUEAACWDQAgCgAAmw0AIAwAAIsMACAOAACMDAAgDwAAlw0AIBEAAJgNACASAACZDQAgFAAApQwAIBUAAJoNACAaAACcDQAg7wUAAN8IACD8BQAA3wgAIP0FAADfCAAg_gUAAN8IACCDBgAA3wgAIIQGAADfCAAghQYAAN8IACCGBgAA3wgAIIcGAADfCAAgiAYAAN8IACCJBgAA3wgAIAAAAAUnAACrDgAgKAAAsQ4AII4GAACsDgAgjwYAALAOACCUBgAAKAAgBScAAKkOACAoAACuDgAgjgYAAKoOACCPBgAArQ4AIJQGAAABACADJwAAqw4AII4GAACsDgAglAYAACgAIAMnAACpDgAgjgYAAKoOACCUBgAAAQAgAAAAAAAFkQYIAAAAAZgGCAAAAAGZBggAAAABmgYIAAAAAZsGCAAAAAECkQYBAAAABJcGAQAAAAUCkQYBAAAABJcGAQAAAAUBkQYAAADWBAIFJwAAng4AICgAAKcOACCOBgAAnw4AII8GAACmDgAglAYAAAEAIAcnAACcDgAgKAAApA4AII4GAACdDgAgjwYAAKMOACCSBgAADAAgkwYAAAwAIJQGAADcAQAgBycAAJoOACAoAAChDgAgjgYAAJsOACCPBgAAoA4AIJIGAAAJACCTBgAACQAglAYAAA8AIAGRBgEAAAAEAZEGAQAAAAQDJwAAng4AII4GAACfDgAglAYAAAEAIAMnAACcDgAgjgYAAJ0OACCUBgAA3AEAIAMnAACaDgAgjgYAAJsOACCUBgAADwAgAAAAAAAAAAAAAAAAAAAABScAAJUOACAoAACYDgAgjgYAAJYOACCPBgAAlw4AIJQGAADABgAgAycAAJUOACCOBgAAlg4AIJQGAADABgAgAAAAAAAFJwAAkA4AICgAAJMOACCOBgAAkQ4AII8GAACSDgAglAYAACgAIAMnAACQDgAgjgYAAJEOACCUBgAAKAAgAAAAAAABkQYAAAD3BAIBkQYAAAD5BAIBkQYAAAD8BAIBkQYAAAD_BAIFkQYIAAAAAZgGCAAAAAGZBggAAAABmgYIAAAAAZsGCAAAAAECkQYBAAAABJcGAQAAAAUBkQYAAACIBQIBkQYAAACNBQIFJwAAhg4AICgAAI4OACCOBgAAhw4AII8GAACNDgAglAYAAAEAIAUnAACEDgAgKAAAiw4AII4GAACFDgAgjwYAAIoOACCUBgAADwAgCycAAPoJADAoAAD_CQAwjgYAAPsJADCPBgAA_AkAMJAGAAD9CQAgkQYAAP4JADCSBgAA_gkAMJMGAAD-CQAwlAYAAP4JADCVBgAAgAoAMJYGAACBCgAwCycAAO4JADAoAADzCQAwjgYAAO8JADCPBgAA8AkAMJAGAADxCQAgkQYAAPIJADCSBgAA8gkAMJMGAADyCQAwlAYAAPIJADCVBgAA9AkAMJYGAAD1CQAwBQMAALMJACCuBEAAAAABrwRAAAAAAbwEAQAAAAHGBAEAAAABAgAAADAAICcAAPkJACADAAAAMAAgJwAA-QkAICgAAPgJACABIAAAiQ4AMAsDAACXBwAgDwAAsggAIKYEAACxCAAwpwQAAC4AEKgEAACxCAAwrgRAAIYHACGvBEAAhgcAIbwEAQCCBwAhxgQBAAAAAccEAQCCBwAhiwYAALAIACACAAAAMAAgIAAA-AkAIAIAAAD2CQAgIAAA9wkAIAimBAAA9QkAMKcEAAD2CQAQqAQAAPUJADCuBEAAhgcAIa8EQACGBwAhvAQBAIIHACHGBAEAggcAIccEAQCCBwAhCKYEAAD1CQAwpwQAAPYJABCoBAAA9QkAMK4EQACGBwAhrwRAAIYHACG8BAEAggcAIcYEAQCCBwAhxwQBAIIHACEErgRAAN4IACGvBEAA3ggAIbwEAQDbCAAhxgQBANsIACEFAwAAsQkAIK4EQADeCAAhrwRAAN4IACG8BAEA2wgAIcYEAQDbCAAhBQMAALMJACCuBEAAAAABrwRAAAAAAbwEAQAAAAHGBAEAAAABBq4EQAAAAAGvBEAAAAAB8QQBAAAAAfIEAQAAAAHzBAEAAAAB9AQCAAAAAQIAAAAsACAnAACFCgAgAwAAACwAICcAAIUKACAoAACECgAgASAAAIgOADALDwAAsggAIKYEAACzCAAwpwQAACoAEKgEAACzCAAwrgRAAIYHACGvBEAAhgcAIccEAQCCBwAh8QQBAAAAAfIEAQCDBwAh8wQBAM0HACH0BAIAhAcAIQIAAAAsACAgAACECgAgAgAAAIIKACAgAACDCgAgCqYEAACBCgAwpwQAAIIKABCoBAAAgQoAMK4EQACGBwAhrwRAAIYHACHHBAEAggcAIfEEAQCCBwAh8gQBAIMHACHzBAEAzQcAIfQEAgCEBwAhCqYEAACBCgAwpwQAAIIKABCoBAAAgQoAMK4EQACGBwAhrwRAAIYHACHHBAEAggcAIfEEAQCCBwAh8gQBAIMHACHzBAEAzQcAIfQEAgCEBwAhBq4EQADeCAAhrwRAAN4IACHxBAEA2wgAIfIEAQDbCAAh8wQBAPkIACH0BAIA3AgAIQauBEAA3ggAIa8EQADeCAAh8QQBANsIACHyBAEA2wgAIfMEAQD5CAAh9AQCANwIACEGrgRAAAAAAa8EQAAAAAHxBAEAAAAB8gQBAAAAAfMEAQAAAAH0BAIAAAABAZEGAQAAAAQDJwAAhg4AII4GAACHDgAglAYAAAEAIAMnAACEDgAgjgYAAIUOACCUBgAADwAgBCcAAPoJADCOBgAA-wkAMJAGAAD9CQAglAYAAP4JADAEJwAA7gkAMI4GAADvCQAwkAYAAPEJACCUBgAA8gkAMAAAAAAAAAAAAAAAAZEGAAAAmgUCAZEGAAAAoAUCBycAAPwNACAoAACCDgAgjgYAAP0NACCPBgAAgQ4AIJIGAAAHACCTBgAABwAglAYAAAEAIAcnAAD6DQAgKAAA_w0AII4GAAD7DQAgjwYAAP4NACCSBgAACQAgkwYAAAkAIJQGAAAPACADJwAA_A0AII4GAAD9DQAglAYAAAEAIAMnAAD6DQAgjgYAAPsNACCUBgAADwAgAAAAAAAFJwAA9Q0AICgAAPgNACCOBgAA9g0AII8GAAD3DQAglAYAAMAGACADJwAA9Q0AII4GAAD2DQAglAYAAMAGACAAAAAAAAAAAAAAAAAAAAAFJwAA8A0AICgAAPMNACCOBgAA8Q0AII8GAADyDQAglAYAAMAGACADJwAA8A0AII4GAADxDQAglAYAAMAGACAAAAABkQYAAACzBQIAAAAKJwAAvAoAMCgAAMAKADCOBgAAvQoAMI8GAAC-CgAwkQYAAL8KADCSBgAAvwoAMJMGAAC_CgAwlAYAAL8KADCVBgAAwQoAMJYGAADCCgAwD-MBAADJCgAgrgRAAAAAAa8EQAAAAAHJBAEAAAABygQBAAAAAdYEAAAAugUC2wRAAAAAAbQFAQAAAAG1BQEAAAABtgUBAAAAAbcFAQAAAAG4BQIAAAABugUBAAAAAbsFAQAAAAG8BQEAAAABAgAAAIkDACAnAADICgAgAwAAAIkDACAnAADICgAgKAAAxgoAIBPjAQAA-AcAIOUBAAD5BwAgpgQAAPQHADCnBAAAhwMAEKgEAAD0BwAwrgRAAIYHACGvBEAAhgcAIckEAQCDBwAhygQBAIMHACHWBAAA9ge6BSLbBEAAkgcAIbQFAQAAAAG1BQEAAAABtgUBAIMHACG3BQEAzQcAIbgFAgD1BwAhugUBAPcHACG7BQEAzQcAIbwFAQDNBwAhAgAAAIkDACAgAADGCgAgAgAAAMMKACAgAADECgAgEaYEAADCCgAwpwQAAMMKABCoBAAAwgoAMK4EQACGBwAhrwRAAIYHACHJBAEAgwcAIcoEAQCDBwAh1gQAAPYHugUi2wRAAJIHACG0BQEAgwcAIbUFAQCCBwAhtgUBAIMHACG3BQEAzQcAIbgFAgD1BwAhugUBAPcHACG7BQEAzQcAIbwFAQDNBwAhEaYEAADCCgAwpwQAAMMKABCoBAAAwgoAMK4EQACGBwAhrwRAAIYHACHJBAEAgwcAIcoEAQCDBwAh1gQAAPYHugUi2wRAAJIHACG0BQEAgwcAIbUFAQCCBwAhtgUBAIMHACG3BQEAzQcAIbgFAgD1BwAhugUBAPcHACG7BQEAzQcAIbwFAQDNBwAhDq4EQADeCAAhrwRAAN4IACHJBAEA2wgAIcoEAQDbCAAh1gQAAMUKugUi2wRAAOYIACG0BQEA2wgAIbUFAQDbCAAhtgUBANsIACG3BQEA-QgAIbgFAgD2CAAhugUBAPkIACG7BQEA-QgAIbwFAQD5CAAhAZEGAAAAugUCD-MBAADHCgAgrgRAAN4IACGvBEAA3ggAIckEAQDbCAAhygQBANsIACHWBAAAxQq6BSLbBEAA5ggAIbQFAQDbCAAhtQUBANsIACG2BQEA2wgAIbcFAQD5CAAhuAUCAPYIACG6BQEA-QgAIbsFAQD5CAAhvAUBAPkIACEHJwAA6w0AICgAAO4NACCOBgAA7A0AII8GAADtDQAgkgYAAIsDACCTBgAAiwMAIJQGAACFAwAgD-MBAADJCgAgrgRAAAAAAa8EQAAAAAHJBAEAAAABygQBAAAAAdYEAAAAugUC2wRAAAAAAbQFAQAAAAG1BQEAAAABtgUBAAAAAbcFAQAAAAG4BQIAAAABugUBAAAAAbsFAQAAAAG8BQEAAAABAycAAOsNACCOBgAA7A0AIJQGAACFAwAgAycAALwKADCOBgAAvQoAMJQGAAC_CgAwAAAAAAAKJwAA0QoAMCgAANUKADCOBgAA0goAMI8GAADTCgAwkQYAANQKADCSBgAA1AoAMJMGAADUCgAwlAYAANQKADCVBgAA1goAMJYGAADXCgAwBa4EQAAAAAGvBEAAAAABrwUBAAAAAbMFAQAAAAG0BQEAAAABAgAAAI8DACAnAADbCgAgAwAAAI8DACAnAADbCgAgKAAA2goAIAnkAQAA8gcAIKYEAADxBwAwpwQAAI0DABCoBAAA8QcAMK4EQACGBwAhrwRAAIYHACGvBQEAAAABswUBAAAAAbQFAQAAAAECAAAAjwMAICAAANoKACACAAAA2AoAICAAANkKACAIpgQAANcKADCnBAAA2AoAEKgEAADXCgAwrgRAAIYHACGvBEAAhgcAIa8FAQCDBwAhswUBAIIHACG0BQEAgwcAIQimBAAA1woAMKcEAADYCgAQqAQAANcKADCuBEAAhgcAIa8EQACGBwAhrwUBAIMHACGzBQEAggcAIbQFAQCDBwAhBa4EQADeCAAhrwRAAN4IACGvBQEA2wgAIbMFAQDbCAAhtAUBANsIACEFrgRAAN4IACGvBEAA3ggAIa8FAQDbCAAhswUBANsIACG0BQEA2wgAIQWuBEAAAAABrwRAAAAAAa8FAQAAAAGzBQEAAAABtAUBAAAAAQMnAADRCgAwjgYAANIKADCUBgAA1AoAMAAAAAsnAADhCgAwKAAA5QoAMI4GAADiCgAwjwYAAOMKADCQBgAA5AoAIJEGAAC_CgAwkgYAAL8KADCTBgAAvwoAMJQGAAC_CgAwlQYAAOYKADCWBgAAwgoAMA7lAQAA3AoAIK4EQAAAAAGvBEAAAAAByQQBAAAAAcoEAQAAAAHWBAAAALoFAtsEQAAAAAG0BQEAAAABtQUBAAAAAbYFAQAAAAG3BQEAAAABuAUCAAAAAbsFAQAAAAG8BQEAAAABAgAAAIkDACAnAADpCgAgAwAAAIkDACAnAADpCgAgKAAA6AoAIAEgAADqDQAwAgAAAIkDACAgAADoCgAgAgAAAMMKACAgAADnCgAgDa4EQADeCAAhrwRAAN4IACHJBAEA2wgAIcoEAQDbCAAh1gQAAMUKugUi2wRAAOYIACG0BQEA2wgAIbUFAQDbCAAhtgUBANsIACG3BQEA-QgAIbgFAgD2CAAhuwUBAPkIACG8BQEA-QgAIQ7lAQAA0AoAIK4EQADeCAAhrwRAAN4IACHJBAEA2wgAIcoEAQDbCAAh1gQAAMUKugUi2wRAAOYIACG0BQEA2wgAIbUFAQDbCAAhtgUBANsIACG3BQEA-QgAIbgFAgD2CAAhuwUBAPkIACG8BQEA-QgAIQ7lAQAA3AoAIK4EQAAAAAGvBEAAAAAByQQBAAAAAcoEAQAAAAHWBAAAALoFAtsEQAAAAAG0BQEAAAABtQUBAAAAAbYFAQAAAAG3BQEAAAABuAUCAAAAAbsFAQAAAAG8BQEAAAABBCcAAOEKADCOBgAA4goAMJAGAADkCgAglAYAAL8KADAAAuQBAADrCgAg9QQAAN8IACAAAAAAAAAFJwAA5Q0AICgAAOgNACCOBgAA5g0AII8GAADnDQAglAYAAMAGACADJwAA5Q0AII4GAADmDQAglAYAAMAGACAAAAABkQYAAADIBQIFJwAA4A0AICgAAOMNACCOBgAA4Q0AII8GAADiDQAglAYAAAEAIAMnAADgDQAgjgYAAOENACCUBgAAAQAgAAAAAAAAAAABkQYAAADVBQIFJwAA2A0AICgAAN4NACCOBgAA2Q0AII8GAADdDQAglAYAAAEAIAUnAADWDQAgKAAA2w0AII4GAADXDQAgjwYAANoNACCUBgAAEwAgAycAANgNACCOBgAA2Q0AIJQGAAABACADJwAA1g0AII4GAADXDQAglAYAABMAIAAAAAAAAZEGAAAA2QUCBycAAMoNACAoAADUDQAgjgYAAMsNACCPBgAA0w0AIJIGAAAMACCTBgAADAAglAYAANwBACAHJwAAyA0AICgAANENACCOBgAAyQ0AII8GAADQDQAgkgYAAAkAIJMGAAAJACCUBgAADwAgBycAAMYNACAoAADODQAgjgYAAMcNACCPBgAAzQ0AIJIGAAAHACCTBgAABwAglAYAAAEAIAsnAACSCwAwKAAAlwsAMI4GAACTCwAwjwYAAJQLADCQBgAAlQsAIJEGAACWCwAwkgYAAJYLADCTBgAAlgsAMJQGAACWCwAwlQYAAJgLADCWBgAAmQsAMAsIAACGCwAg1gQAAADVBQKrBQIAAAABxAUBAAAAAcoFQAAAAAHLBUAAAAABzwUBAAAAAdEFAQAAAAHSBQEAAAAB0wUBAAAAAdUFQAAAAAECAAAAGgAgJwAAnQsAIAMAAAAaACAnAACdCwAgKAAAnAsAIAEgAADMDQAwEAgAAJcHACAJAADFCAAgpgQAAMMIADCnBAAAGAAQqAQAAMMIADDWBAAAxAjVBSKrBQIAhAcAIcQFAQCCBwAhygVAAIYHACHLBUAAhgcAIc8FAQAAAAHQBQEAgwcAIdEFAQAAAAHSBQEAzQcAIdMFAQCDBwAh1QVAAJIHACECAAAAGgAgIAAAnAsAIAIAAACaCwAgIAAAmwsAIA6mBAAAmQsAMKcEAACaCwAQqAQAAJkLADDWBAAAxAjVBSKrBQIAhAcAIcQFAQCCBwAhygVAAIYHACHLBUAAhgcAIc8FAQCCBwAh0AUBAIMHACHRBQEAzQcAIdIFAQDNBwAh0wUBAIMHACHVBUAAkgcAIQ6mBAAAmQsAMKcEAACaCwAQqAQAAJkLADDWBAAAxAjVBSKrBQIAhAcAIcQFAQCCBwAhygVAAIYHACHLBUAAhgcAIc8FAQCCBwAh0AUBAIMHACHRBQEAzQcAIdIFAQDNBwAh0wUBAIMHACHVBUAAkgcAIQrWBAAAgwvVBSKrBQIA3AgAIcQFAQDbCAAhygVAAN4IACHLBUAA3ggAIc8FAQDbCAAh0QUBAPkIACHSBQEA-QgAIdMFAQDbCAAh1QVAAOYIACELCAAAhAsAINYEAACDC9UFIqsFAgDcCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAhzwUBANsIACHRBQEA-QgAIdIFAQD5CAAh0wUBANsIACHVBUAA5ggAIQsIAACGCwAg1gQAAADVBQKrBQIAAAABxAUBAAAAAcoFQAAAAAHLBUAAAAABzwUBAAAAAdEFAQAAAAHSBQEAAAAB0wUBAAAAAdUFQAAAAAEDJwAAyg0AII4GAADLDQAglAYAANwBACADJwAAyA0AII4GAADJDQAglAYAAA8AIAMnAADGDQAgjgYAAMcNACCUBgAAAQAgBCcAAJILADCOBgAAkwsAMJAGAACVCwAglAYAAJYLADAAAAAAAAsnAADQCwAwKAAA1QsAMI4GAADRCwAwjwYAANILADCQBgAA0wsAIJEGAADUCwAwkgYAANQLADCTBgAA1AsAMJQGAADUCwAwlQYAANYLADCWBgAA1wsAMAcnAAC9DQAgKAAAxA0AII4GAAC-DQAgjwYAAMMNACCSBgAADAAgkwYAAAwAIJQGAADcAQAgCycAAMQLADAoAADJCwAwjgYAAMULADCPBgAAxgsAMJAGAADHCwAgkQYAAMgLADCSBgAAyAsAMJMGAADICwAwlAYAAMgLADCVBgAAygsAMJYGAADLCwAwCycAALgLADAoAAC9CwAwjgYAALkLADCPBgAAugsAMJAGAAC7CwAgkQYAALwLADCSBgAAvAsAMJMGAAC8CwAwlAYAALwLADCVBgAAvgsAMJYGAAC_CwAwCycAAKwLADAoAACxCwAwjgYAAK0LADCPBgAArgsAMJAGAACvCwAgkQYAALALADCSBgAAsAsAMJMGAACwCwAwlAYAALALADCVBgAAsgsAMJYGAACzCwAwEgYAAJ4LACAIAACgCwAgCgAAoQsAINYEAAAA2QUC9QQBAAAAAa8FAQAAAAHEBQEAAAABygVAAAAAAcsFQAAAAAHQBQEAAAAB1gUBAAAAAdkFCAAAAAHaBQgAAAAB2wUIAAAAAdwFgAAAAAHdBYAAAAAB3gUBAAAAAd8FQAAAAAECAAAAEwAgJwAAtwsAIAMAAAATACAnAAC3CwAgKAAAtgsAIAEgAADCDQAwFwYAAMEIACAHAADCCAAgCAAAyQgAIAoAAMoIACCmBAAAxggAMKcEAAARABCoBAAAxggAMNYEAADHCNkFIvUEAQDNBwAhrwUBAM0HACHEBQEA9wcAIcoFQACGBwAhywVAAIYHACHQBQEAAAAB1gUBAM0HACHXBQEAzQcAIdkFCACTCAAh2gUIAJMIACHbBQgAkwgAIdwFAADICAAg3QUAAMgIACDeBQEAzQcAId8FQACSBwAhAgAAABMAICAAALYLACACAAAAtAsAICAAALULACATpgQAALMLADCnBAAAtAsAEKgEAACzCwAw1gQAAMcI2QUi9QQBAM0HACGvBQEAzQcAIcQFAQD3BwAhygVAAIYHACHLBUAAhgcAIdAFAQCDBwAh1gUBAM0HACHXBQEAzQcAIdkFCACTCAAh2gUIAJMIACHbBQgAkwgAIdwFAADICAAg3QUAAMgIACDeBQEAzQcAId8FQACSBwAhE6YEAACzCwAwpwQAALQLABCoBAAAswsAMNYEAADHCNkFIvUEAQDNBwAhrwUBAM0HACHEBQEA9wcAIcoFQACGBwAhywVAAIYHACHQBQEAgwcAIdYFAQDNBwAh1wUBAM0HACHZBQgAkwgAIdoFCACTCAAh2wUIAJMIACHcBQAAyAgAIN0FAADICAAg3gUBAM0HACHfBUAAkgcAIQ_WBAAAjQvZBSL1BAEA-QgAIa8FAQD5CAAhxAUBAPkIACHKBUAA3ggAIcsFQADeCAAh0AUBANsIACHWBQEA-QgAIdkFCADmCQAh2gUIAOYJACHbBQgA5gkAIdwFgAAAAAHdBYAAAAAB3gUBAPkIACHfBUAA5ggAIRIGAACOCwAgCAAAkAsAIAoAAJELACDWBAAAjQvZBSL1BAEA-QgAIa8FAQD5CAAhxAUBAPkIACHKBUAA3ggAIcsFQADeCAAh0AUBANsIACHWBQEA-QgAIdkFCADmCQAh2gUIAOYJACHbBQgA5gkAIdwFgAAAAAHdBYAAAAAB3gUBAPkIACHfBUAA5ggAIRIGAACeCwAgCAAAoAsAIAoAAKELACDWBAAAANkFAvUEAQAAAAGvBQEAAAABxAUBAAAAAcoFQAAAAAHLBUAAAAAB0AUBAAAAAdYFAQAAAAHZBQgAAAAB2gUIAAAAAdsFCAAAAAHcBYAAAAAB3QWAAAAAAd4FAQAAAAHfBUAAAAABFgMAAMIJACANAADDCQAgrgRAAAAAAa8EQAAAAAHIBAEAAAAByQQBAAAAAcoEAQAAAAHLBAIAAAABzAQCAAAAAc0EAgAAAAHOBAIAAAABzwQIAAAAAdAEAADACQAg0QQAAMEJACDSBAIAAAAB0wQgAAAAAdQEIAAAAAHWBAAAANYEAtcEAQAAAAHYBAEAAAAB2gQBAAAAAdsEQAAAAAECAAAAHwAgJwAAwwsAIAMAAAAfACAnAADDCwAgKAAAwgsAIAEgAADBDQAwGwMAAJcHACAFAADCCAAgDQAAwQgAIKYEAAC-CAAwpwQAAB0AEKgEAAC-CAAwrgRAAIYHACGvBEAAhgcAIcgEAQAAAAHJBAEAgwcAIcoEAQCDBwAhywQCAIQHACHMBAIAhAcAIc0EAgCEBwAhzgQCAIQHACHPBAgAvwgAIdAEAACbBwAg0QQAAJsHACDSBAIA9QcAIdMEIADMBwAh1AQgAMwHACHWBAAAwAjWBCLXBAEAzQcAIdgEAQCCBwAh2QQBAM0HACHaBAEAzQcAIdsEQACSBwAhAgAAAB8AICAAAMILACACAAAAwAsAICAAAMELACAYpgQAAL8LADCnBAAAwAsAEKgEAAC_CwAwrgRAAIYHACGvBEAAhgcAIcgEAQCCBwAhyQQBAIMHACHKBAEAgwcAIcsEAgCEBwAhzAQCAIQHACHNBAIAhAcAIc4EAgCEBwAhzwQIAL8IACHQBAAAmwcAINEEAACbBwAg0gQCAPUHACHTBCAAzAcAIdQEIADMBwAh1gQAAMAI1gQi1wQBAM0HACHYBAEAggcAIdkEAQDNBwAh2gQBAM0HACHbBEAAkgcAIRimBAAAvwsAMKcEAADACwAQqAQAAL8LADCuBEAAhgcAIa8EQACGBwAhyAQBAIIHACHJBAEAgwcAIcoEAQCDBwAhywQCAIQHACHMBAIAhAcAIc0EAgCEBwAhzgQCAIQHACHPBAgAvwgAIdAEAACbBwAg0QQAAJsHACDSBAIA9QcAIdMEIADMBwAh1AQgAMwHACHWBAAAwAjWBCLXBAEAzQcAIdgEAQCCBwAh2QQBAM0HACHaBAEAzQcAIdsEQACSBwAhFK4EQADeCAAhrwRAAN4IACHIBAEA2wgAIckEAQDbCAAhygQBANsIACHLBAIA3AgAIcwEAgDcCAAhzQQCANwIACHOBAIA3AgAIc8ECAC5CQAh0AQAALoJACDRBAAAuwkAINIEAgD2CAAh0wQgAKAJACHUBCAAoAkAIdYEAAC8CdYEItcEAQD5CAAh2AQBANsIACHaBAEA-QgAIdsEQADmCAAhFgMAAL0JACANAAC-CQAgrgRAAN4IACGvBEAA3ggAIcgEAQDbCAAhyQQBANsIACHKBAEA2wgAIcsEAgDcCAAhzAQCANwIACHNBAIA3AgAIc4EAgDcCAAhzwQIALkJACHQBAAAugkAINEEAAC7CQAg0gQCAPYIACHTBCAAoAkAIdQEIACgCQAh1gQAALwJ1gQi1wQBAPkIACHYBAEA2wgAIdoEAQD5CAAh2wRAAOYIACEWAwAAwgkAIA0AAMMJACCuBEAAAAABrwRAAAAAAcgEAQAAAAHJBAEAAAABygQBAAAAAcsEAgAAAAHMBAIAAAABzQQCAAAAAc4EAgAAAAHPBAgAAAAB0AQAAMAJACDRBAAAwQkAINIEAgAAAAHTBCAAAAAB1AQgAAAAAdYEAAAA1gQC1wQBAAAAAdgEAQAAAAHaBAEAAAAB2wRAAAAAAR8DAACHCgAgEAAAiQoAIBEAAIoKACCuBEAAAAABrwRAAAAAAccEAQAAAAHJBAEAAAAB1AQgAAAAAdYEAAAAjQUC5gQCAAAAAecEAgAAAAH1BAEAAAAB9wQAAAD3BAL5BAAAAPkEAvoEEAAAAAH8BAAAAPwEAv0EAgAAAAH_BAAAAP8EAoAFAQAAAAGBBQgAAAABggUIAAAAAYMFAACGCgAghAVAAAAAAYUFAQAAAAGGBRAAAAABiAUAAACIBQKJBQEAAAABigUBAAAAAYsFIAAAAAGNBQIAAAABjgUBAAAAAQIAAAAoACAnAADPCwAgAwAAACgAICcAAM8LACAoAADOCwAgASAAAMANADAkAwAAlwcAIAUAALsIACAQAAC8CAAgEQAAvQgAIKYEAAC0CAAwpwQAACYAEKgEAAC0CAAwrgRAAIYHACGvBEAAhgcAIccEAQAAAAHJBAEAgwcAIdQEIADMBwAh1gQAALoIjQUi2QQBAIMHACHmBAIAhAcAIecEAgCEBwAh9QQBAIMHACH3BAAAtQj3BCL5BAAAtgj5BCL6BBAAhQcAIfwEAAC3CPwEIv0EAgD1BwAh_wQAALgI_wQigAUBAIMHACGBBQgAkwgAIYIFCACTCAAhgwUAAJsHACCEBUAAkgcAIYUFAQDNBwAhhgUQAKYIACGIBQAAuQiIBSKJBQEAzQcAIYoFAQDNBwAhiwUgAMwHACGNBQIAhAcAIY4FAQCCBwAhAgAAACgAICAAAM4LACACAAAAzAsAICAAAM0LACAgpgQAAMsLADCnBAAAzAsAEKgEAADLCwAwrgRAAIYHACGvBEAAhgcAIccEAQCCBwAhyQQBAIMHACHUBCAAzAcAIdYEAAC6CI0FItkEAQCDBwAh5gQCAIQHACHnBAIAhAcAIfUEAQCDBwAh9wQAALUI9wQi-QQAALYI-QQi-gQQAIUHACH8BAAAtwj8BCL9BAIA9QcAIf8EAAC4CP8EIoAFAQCDBwAhgQUIAJMIACGCBQgAkwgAIYMFAACbBwAghAVAAJIHACGFBQEAzQcAIYYFEACmCAAhiAUAALkIiAUiiQUBAM0HACGKBQEAzQcAIYsFIADMBwAhjQUCAIQHACGOBQEAggcAISCmBAAAywsAMKcEAADMCwAQqAQAAMsLADCuBEAAhgcAIa8EQACGBwAhxwQBAIIHACHJBAEAgwcAIdQEIADMBwAh1gQAALoIjQUi2QQBAIMHACHmBAIAhAcAIecEAgCEBwAh9QQBAIMHACH3BAAAtQj3BCL5BAAAtgj5BCL6BBAAhQcAIfwEAAC3CPwEIv0EAgD1BwAh_wQAALgI_wQigAUBAIMHACGBBQgAkwgAIYIFCACTCAAhgwUAAJsHACCEBUAAkgcAIYUFAQDNBwAhhgUQAKYIACGIBQAAuQiIBSKJBQEAzQcAIYoFAQDNBwAhiwUgAMwHACGNBQIAhAcAIY4FAQCCBwAhHK4EQADeCAAhrwRAAN4IACHHBAEA2wgAIckEAQDbCAAh1AQgAKAJACHWBAAA6QmNBSLmBAIA3AgAIecEAgDcCAAh9QQBANsIACH3BAAA4gn3BCL5BAAA4wn5BCL6BBAA3QgAIfwEAADkCfwEIv0EAgD2CAAh_wQAAOUJ_wQigAUBANsIACGBBQgA5gkAIYIFCADmCQAhgwUAAOcJACCEBUAA5ggAIYUFAQD5CAAhhgUQAPgIACGIBQAA6AmIBSKJBQEA-QgAIYoFAQD5CAAhiwUgAKAJACGNBQIA3AgAIY4FAQDbCAAhHwMAAOoJACAQAADsCQAgEQAA7QkAIK4EQADeCAAhrwRAAN4IACHHBAEA2wgAIckEAQDbCAAh1AQgAKAJACHWBAAA6QmNBSLmBAIA3AgAIecEAgDcCAAh9QQBANsIACH3BAAA4gn3BCL5BAAA4wn5BCL6BBAA3QgAIfwEAADkCfwEIv0EAgD2CAAh_wQAAOUJ_wQigAUBANsIACGBBQgA5gkAIYIFCADmCQAhgwUAAOcJACCEBUAA5ggAIYUFAQD5CAAhhgUQAPgIACGIBQAA6AmIBSKJBQEA-QgAIYoFAQD5CAAhiwUgAKAJACGNBQIA3AgAIY4FAQDbCAAhHwMAAIcKACAQAACJCgAgEQAAigoAIK4EQAAAAAGvBEAAAAABxwQBAAAAAckEAQAAAAHUBCAAAAAB1gQAAACNBQLmBAIAAAAB5wQCAAAAAfUEAQAAAAH3BAAAAPcEAvkEAAAA-QQC-gQQAAAAAfwEAAAA_AQC_QQCAAAAAf8EAAAA_wQCgAUBAAAAAYEFCAAAAAGCBQgAAAABgwUAAIYKACCEBUAAAAABhQUBAAAAAYYFEAAAAAGIBQAAAIgFAokFAQAAAAGKBQEAAAABiwUgAAAAAY0FAgAAAAGOBQEAAAABEAMAAJoKACCuBEAAAAABrwRAAAAAAckEAQAAAAHTBCAAAAAB1gQAAACgBQLYBAEAAAAB2wRAAAAAAfcEAAAAmgUCmAUBAAAAAZoFAQAAAAGbBQEAAAABnAUBAAAAAZ0FAgAAAAGeBQEAAAABoAUBAAAAAQIAAAAFACAnAADbCwAgAwAAAAUAICcAANsLACAoAADaCwAgASAAAL8NADAVAwAAyQgAIAUAAMIIACCmBAAA0wgAMKcEAAADABCoBAAA0wgAMK4EQACGBwAhrwRAAIYHACHJBAEAgwcAIdMEIADMBwAh1gQAANUIoAUi2AQBAPcHACHZBAEAzQcAIdsEQACSBwAh9wQAANQImgUimAUBAAAAAZoFAQCDBwAhmwUBAM0HACGcBQEAzQcAIZ0FAgD1BwAhngUBAM0HACGgBQEAzQcAIQIAAAAFACAgAADaCwAgAgAAANgLACAgAADZCwAgE6YEAADXCwAwpwQAANgLABCoBAAA1wsAMK4EQACGBwAhrwRAAIYHACHJBAEAgwcAIdMEIADMBwAh1gQAANUIoAUi2AQBAPcHACHZBAEAzQcAIdsEQACSBwAh9wQAANQImgUimAUBAIIHACGaBQEAgwcAIZsFAQDNBwAhnAUBAM0HACGdBQIA9QcAIZ4FAQDNBwAhoAUBAM0HACETpgQAANcLADCnBAAA2AsAEKgEAADXCwAwrgRAAIYHACGvBEAAhgcAIckEAQCDBwAh0wQgAMwHACHWBAAA1QigBSLYBAEA9wcAIdkEAQDNBwAh2wRAAJIHACH3BAAA1AiaBSKYBQEAggcAIZoFAQCDBwAhmwUBAM0HACGcBQEAzQcAIZ0FAgD1BwAhngUBAM0HACGgBQEAzQcAIQ-uBEAA3ggAIa8EQADeCAAhyQQBANsIACHTBCAAoAkAIdYEAACXCqAFItgEAQD5CAAh2wRAAOYIACH3BAAAlgqaBSKYBQEA2wgAIZoFAQDbCAAhmwUBAPkIACGcBQEA-QgAIZ0FAgD2CAAhngUBAPkIACGgBQEA-QgAIRADAACYCgAgrgRAAN4IACGvBEAA3ggAIckEAQDbCAAh0wQgAKAJACHWBAAAlwqgBSLYBAEA-QgAIdsEQADmCAAh9wQAAJYKmgUimAUBANsIACGaBQEA2wgAIZsFAQD5CAAhnAUBAPkIACGdBQIA9ggAIZ4FAQD5CAAhoAUBAPkIACEQAwAAmgoAIK4EQAAAAAGvBEAAAAAByQQBAAAAAdMEIAAAAAHWBAAAAKAFAtgEAQAAAAHbBEAAAAAB9wQAAACaBQKYBQEAAAABmgUBAAAAAZsFAQAAAAGcBQEAAAABnQUCAAAAAZ4FAQAAAAGgBQEAAAABBCcAANALADCOBgAA0QsAMJAGAADTCwAglAYAANQLADADJwAAvQ0AII4GAAC-DQAglAYAANwBACAEJwAAxAsAMI4GAADFCwAwkAYAAMcLACCUBgAAyAsAMAQnAAC4CwAwjgYAALkLADCQBgAAuwsAIJQGAAC8CwAwBCcAAKwLADCOBgAArQsAMJAGAACvCwAglAYAALALADAAAAAAAAsnAAD7CwAwKAAAgAwAMI4GAAD8CwAwjwYAAP0LADCQBgAA_gsAIJEGAAD_CwAwkgYAAP8LADCTBgAA_wsAMJQGAAD_CwAwlQYAAIEMADCWBgAAggwAMAsnAADyCwAwKAAA9gsAMI4GAADzCwAwjwYAAPQLADCQBgAA9QsAIJEGAACwCwAwkgYAALALADCTBgAAsAsAMJQGAACwCwAwlQYAAPcLADCWBgAAswsAMAsnAADpCwAwKAAA7QsAMI4GAADqCwAwjwYAAOsLADCQBgAA7AsAIJEGAAC8CwAwkgYAALwLADCTBgAAvAsAMJQGAAC8CwAwlQYAAO4LADCWBgAAvwsAMBYDAADCCQAgBQAAxAkAIK4EQAAAAAGvBEAAAAAByAQBAAAAAckEAQAAAAHKBAEAAAABywQCAAAAAcwEAgAAAAHNBAIAAAABzgQCAAAAAc8ECAAAAAHQBAAAwAkAINEEAADBCQAg0gQCAAAAAdMEIAAAAAHUBCAAAAAB1gQAAADWBALXBAEAAAAB2AQBAAAAAdkEAQAAAAHbBEAAAAABAgAAAB8AICcAAPELACADAAAAHwAgJwAA8QsAICgAAPALACABIAAAvA0AMAIAAAAfACAgAADwCwAgAgAAAMALACAgAADvCwAgFK4EQADeCAAhrwRAAN4IACHIBAEA2wgAIckEAQDbCAAhygQBANsIACHLBAIA3AgAIcwEAgDcCAAhzQQCANwIACHOBAIA3AgAIc8ECAC5CQAh0AQAALoJACDRBAAAuwkAINIEAgD2CAAh0wQgAKAJACHUBCAAoAkAIdYEAAC8CdYEItcEAQD5CAAh2AQBANsIACHZBAEA-QgAIdsEQADmCAAhFgMAAL0JACAFAAC_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_AsAMJAGAAD-CwAglAYAAP8LADAEJwAA8gsAMI4GAADzCwAwkAYAAPULACCUBgAAsAsAMAQnAADpCwAwjgYAAOoLADCQBgAA7AsAIJQGAAC8CwAwAAAAAAAABScAALINACAoAAC4DQAgjgYAALMNACCPBgAAtw0AIJQGAACtAQAgBScAALANACAoAAC1DQAgjgYAALENACCPBgAAtA0AIJQGAAABACADJwAAsg0AII4GAACzDQAglAYAAK0BACADJwAAsA0AII4GAACxDQAglAYAAAEAIAAAAAsnAACYDAAwKAAAnQwAMI4GAACZDAAwjwYAAJoMADCQBgAAmwwAIJEGAACcDAAwkgYAAJwMADCTBgAAnAwAMJQGAACcDAAwlQYAAJ4MADCWBgAAnwwAMAYIAACTDAAgxAUBAAAAAcoFQAAAAAHLBUAAAAAB7AUBAAAAAe4FIAAAAAECAAAAQQAgJwAAowwAIAMAAABBACAnAACjDAAgKAAAogwAIAEgAACvDQAwDAgAAJcHACATAACvCAAgpgQAAK4IADCnBAAAPwAQqAQAAK4IADDEBQEAggcAIcoFQACGBwAhywVAAIYHACHsBQEAAAAB7QUBAIIHACHuBSAAzAcAIYoGAACtCAAgAgAAAEEAICAAAKIMACACAAAAoAwAICAAAKEMACAJpgQAAJ8MADCnBAAAoAwAEKgEAACfDAAwxAUBAIIHACHKBUAAhgcAIcsFQACGBwAh7AUBAIIHACHtBQEAggcAIe4FIADMBwAhCaYEAACfDAAwpwQAAKAMABCoBAAAnwwAMMQFAQCCBwAhygVAAIYHACHLBUAAhgcAIewFAQCCBwAh7QUBAIIHACHuBSAAzAcAIQXEBQEA2wgAIcoFQADeCAAhywVAAN4IACHsBQEA2wgAIe4FIACgCQAhBggAAJEMACDEBQEA2wgAIcoFQADeCAAhywVAAN4IACHsBQEA2wgAIe4FIACgCQAhBggAAJMMACDEBQEAAAABygVAAAAAAcsFQAAAAAHsBQEAAAAB7gUgAAAAAQQnAACYDAAwjgYAAJkMADCQBgAAmwwAIJQGAACcDAAwAAAAAAAABScAAKoNACAoAACtDQAgjgYAAKsNACCPBgAArA0AIJQGAAABACADJwAAqg0AII4GAACrDQAglAYAAAEAIAAAAAAAAAGRBgAAAIIGAgsnAACDDQAwKAAAhw0AMI4GAACEDQAwjwYAAIUNADCQBgAAhg0AIJEGAADUCwAwkgYAANQLADCTBgAA1AsAMJQGAADUCwAwlQYAAIgNADCWBgAA1wsAMAsnAAD6DAAwKAAA_gwAMI4GAAD7DAAwjwYAAPwMADCQBgAA_QwAIJEGAADICwAwkgYAAMgLADCTBgAAyAsAMJQGAADICwAwlQYAAP8MADCWBgAAywsAMAsnAADxDAAwKAAA9QwAMI4GAADyDAAwjwYAAPMMADCQBgAA9AwAIJEGAAC8CwAwkgYAALwLADCTBgAAvAsAMJQGAAC8CwAwlQYAAPYMADCWBgAAvwsAMAsnAADoDAAwKAAA7AwAMI4GAADpDAAwjwYAAOoMADCQBgAA6wwAIJEGAADyCQAwkgYAAPIJADCTBgAA8gkAMJQGAADyCQAwlQYAAO0MADCWBgAA9QkAMAcnAADjDAAgKAAA5gwAII4GAADkDAAgjwYAAOUMACCSBgAAPQAgkwYAAD0AIJQGAACVAQAgCycAANoMADAoAADeDAAwjgYAANsMADCPBgAA3AwAMJAGAADdDAAgkQYAAJwMADCSBgAAnAwAMJMGAACcDAAwlAYAAJwMADCVBgAA3wwAMJYGAACfDAAwBycAANUMACAoAADYDAAgjgYAANYMACCPBgAA1wwAIJIGAABFACCTBgAARQAglAYAAMAGACALJwAAzAwAMCgAANAMADCOBgAAzQwAMI8GAADODAAwkAYAAM8MACCRBgAAsAsAMJIGAACwCwAwkwYAALALADCUBgAAsAsAMJUGAADRDAAwlgYAALMLADALJwAAwwwAMCgAAMcMADCOBgAAxAwAMI8GAADFDAAwkAYAAMYMACCRBgAAlgsAMJIGAACWCwAwkwYAAJYLADCUBgAAlgsAMJUGAADIDAAwlgYAAJkLADAHJwAAvgwAICgAAMEMACCOBgAAvwwAII8GAADADAAgkgYAAF0AIJMGAABdACCUBgAA1wIAIAjWBAAAAMgFAsMFAQAAAAHFBQEAAAABxgUBAAAAAcgFQAAAAAHJBSAAAAABygVAAAAAAcsFQAAAAAECAAAA1wIAICcAAL4MACADAAAAXQAgJwAAvgwAICgAAMIMACAKAAAAXQAgIAAAwgwAINYEAAD4CsgFIsMFAQDbCAAhxQUBAPkIACHGBQEA2wgAIcgFQADmCAAhyQUgAKAJACHKBUAA3ggAIcsFQADeCAAhCNYEAAD4CsgFIsMFAQDbCAAhxQUBAPkIACHGBQEA2wgAIcgFQADmCAAhyQUgAKAJACHKBUAA3ggAIcsFQADeCAAhCwkAAIcLACDWBAAAANUFAqsFAgAAAAHKBUAAAAABywVAAAAAAc8FAQAAAAHQBQEAAAAB0QUBAAAAAdIFAQAAAAHTBQEAAAAB1QVAAAAAAQIAAAAaACAnAADLDAAgAwAAABoAICcAAMsMACAoAADKDAAgASAAAKkNADACAAAAGgAgIAAAygwAIAIAAACaCwAgIAAAyQwAIArWBAAAgwvVBSKrBQIA3AgAIcoFQADeCAAhywVAAN4IACHPBQEA2wgAIdAFAQDbCAAh0QUBAPkIACHSBQEA-QgAIdMFAQDbCAAh1QVAAOYIACELCQAAhQsAINYEAACDC9UFIqsFAgDcCAAhygVAAN4IACHLBUAA3ggAIc8FAQDbCAAh0AUBANsIACHRBQEA-QgAIdIFAQD5CAAh0wUBANsIACHVBUAA5ggAIQsJAACHCwAg1gQAAADVBQKrBQIAAAABygVAAAAAAcsFQAAAAAHPBQEAAAAB0AUBAAAAAdEFAQAAAAHSBQEAAAAB0wUBAAAAAdUFQAAAAAESBgAAngsAIAcAAJ8LACAKAAChCwAg1gQAAADZBQL1BAEAAAABrwUBAAAAAcoFQAAAAAHLBUAAAAAB0AUBAAAAAdYFAQAAAAHXBQEAAAAB2QUIAAAAAdoFCAAAAAHbBQgAAAAB3AWAAAAAAd0FgAAAAAHeBQEAAAAB3wVAAAAAAQIAAAATACAnAADUDAAgAwAAABMAICcAANQMACAoAADTDAAgASAAAKgNADACAAAAEwAgIAAA0wwAIAIAAAC0CwAgIAAA0gwAIA_WBAAAjQvZBSL1BAEA-QgAIa8FAQD5CAAhygVAAN4IACHLBUAA3ggAIdAFAQDbCAAh1gUBAPkIACHXBQEA-QgAIdkFCADmCQAh2gUIAOYJACHbBQgA5gkAIdwFgAAAAAHdBYAAAAAB3gUBAPkIACHfBUAA5ggAIRIGAACOCwAgBwAAjwsAIAoAAJELACDWBAAAjQvZBSL1BAEA-QgAIa8FAQD5CAAhygVAAN4IACHLBUAA3ggAIdAFAQDbCAAh1gUBAPkIACHXBQEA-QgAIdkFCADmCQAh2gUIAOYJACHbBQgA5gkAIdwFgAAAAAHdBYAAAAAB3gUBAPkIACHfBUAA5ggAIRIGAACeCwAgBwAAnwsAIAoAAKELACDWBAAAANkFAvUEAQAAAAGvBQEAAAABygVAAAAAAcsFQAAAAAHQBQEAAAAB1gUBAAAAAdcFAQAAAAHZBQgAAAAB2gUIAAAAAdsFCAAAAAHcBYAAAAAB3QWAAAAAAd4FAQAAAAHfBUAAAAABDBYAAKMJACAXAACkCQAgGAAApQkAIBkAAKYJACCuBEAAAAABrwRAAAAAAbsEAQAAAAG9BAIAAAABvwQAAAC_BALABAIAAAABwQQCAAAAAcIEQAAAAAECAAAAwAYAICcAANUMACADAAAARQAgJwAA1QwAICgAANkMACAOAAAARQAgFgAA5wgAIBcAAOgIACAYAADpCAAgGQAA6ggAICAAANkMACCuBEAA3ggAIa8EQADeCAAhuwQBANsIACG9BAIA3AgAIb8EAADlCL8EIsAEAgDcCAAhwQQCANwIACHCBEAA5ggAIQwWAADnCAAgFwAA6AgAIBgAAOkIACAZAADqCAAgrgRAAN4IACGvBEAA3ggAIbsEAQDbCAAhvQQCANwIACG_BAAA5Qi_BCLABAIA3AgAIcEEAgDcCAAhwgRAAOYIACEGEwAAkgwAIMoFQAAAAAHLBUAAAAAB7AUBAAAAAe0FAQAAAAHuBSAAAAABAgAAAEEAICcAAOIMACADAAAAQQAgJwAA4gwAICgAAOEMACABIAAApw0AMAIAAABBACAgAADhDAAgAgAAAKAMACAgAADgDAAgBcoFQADeCAAhywVAAN4IACHsBQEA2wgAIe0FAQDbCAAh7gUgAKAJACEGEwAAkAwAIMoFQADeCAAhywVAAN4IACHsBQEA2wgAIe0FAQDbCAAh7gUgAKAJACEGEwAAkgwAIMoFQAAAAAHLBUAAAAAB7AUBAAAAAe0FAQAAAAHuBSAAAAABB8oFQAAAAAHLBUAAAAAB8QUCAAAAAfIFAQAAAAHzBUAAAAAB9AUBAAAAAfUFQAAAAAECAAAAlQEAICcAAOMMACADAAAAPQAgJwAA4wwAICgAAOcMACAJAAAAPQAgIAAA5wwAIMoFQADeCAAhywVAAN4IACHxBQIA3AgAIfIFAQD5CAAh8wVAAOYIACH0BQEA-QgAIfUFQADmCAAhB8oFQADeCAAhywVAAN4IACHxBQIA3AgAIfIFAQD5CAAh8wVAAOYIACH0BQEA-QgAIfUFQADmCAAhBQ8AALIJACCuBEAAAAABrwRAAAAAAcYEAQAAAAHHBAEAAAABAgAAADAAICcAAPAMACADAAAAMAAgJwAA8AwAICgAAO8MACABIAAApg0AMAIAAAAwACAgAADvDAAgAgAAAPYJACAgAADuDAAgBK4EQADeCAAhrwRAAN4IACHGBAEA2wgAIccEAQDbCAAhBQ8AALAJACCuBEAA3ggAIa8EQADeCAAhxgQBANsIACHHBAEA2wgAIQUPAACyCQAgrgRAAAAAAa8EQAAAAAHGBAEAAAABxwQBAAAAARYFAADECQAgDQAAwwkAIK4EQAAAAAGvBEAAAAAByAQBAAAAAckEAQAAAAHKBAEAAAABywQCAAAAAcwEAgAAAAHNBAIAAAABzgQCAAAAAc8ECAAAAAHQBAAAwAkAINEEAADBCQAg0gQCAAAAAdMEIAAAAAHUBCAAAAAB1gQAAADWBALXBAEAAAAB2QQBAAAAAdoEAQAAAAHbBEAAAAABAgAAAB8AICcAAPkMACADAAAAHwAgJwAA-QwAICgAAPgMACABIAAApQ0AMAIAAAAfACAgAAD4DAAgAgAAAMALACAgAAD3DAAgFK4EQADeCAAhrwRAAN4IACHIBAEA2wgAIckEAQDbCAAhygQBANsIACHLBAIA3AgAIcwEAgDcCAAhzQQCANwIACHOBAIA3AgAIc8ECAC5CQAh0AQAALoJACDRBAAAuwkAINIEAgD2CAAh0wQgAKAJACHUBCAAoAkAIdYEAAC8CdYEItcEAQD5CAAh2QQBAPkIACHaBAEA-QgAIdsEQADmCAAhFgUAAL8JACANAAC-CQAgrgRAAN4IACGvBEAA3ggAIcgEAQDbCAAhyQQBANsIACHKBAEA2wgAIcsEAgDcCAAhzAQCANwIACHNBAIA3AgAIc4EAgDcCAAhzwQIALkJACHQBAAAugkAINEEAAC7CQAg0gQCAPYIACHTBCAAoAkAIdQEIACgCQAh1gQAALwJ1gQi1wQBAPkIACHZBAEA-QgAIdoEAQD5CAAh2wRAAOYIACEWBQAAxAkAIA0AAMMJACCuBEAAAAABrwRAAAAAAcgEAQAAAAHJBAEAAAABygQBAAAAAcsEAgAAAAHMBAIAAAABzQQCAAAAAc4EAgAAAAHPBAgAAAAB0AQAAMAJACDRBAAAwQkAINIEAgAAAAHTBCAAAAAB1AQgAAAAAdYEAAAA1gQC1wQBAAAAAdkEAQAAAAHaBAEAAAAB2wRAAAAAAR8FAACICgAgEAAAiQoAIBEAAIoKACCuBEAAAAABrwRAAAAAAccEAQAAAAHJBAEAAAAB1AQgAAAAAdYEAAAAjQUC2QQBAAAAAeYEAgAAAAHnBAIAAAAB9QQBAAAAAfcEAAAA9wQC-QQAAAD5BAL6BBAAAAAB_AQAAAD8BAL9BAIAAAAB_wQAAAD_BAKABQEAAAABgQUIAAAAAYIFCAAAAAGDBQAAhgoAIIQFQAAAAAGFBQEAAAABhgUQAAAAAYgFAAAAiAUCiQUBAAAAAYoFAQAAAAGLBSAAAAABjQUCAAAAAQIAAAAoACAnAACCDQAgAwAAACgAICcAAIINACAoAACBDQAgASAAAKQNADACAAAAKAAgIAAAgQ0AIAIAAADMCwAgIAAAgA0AIByuBEAA3ggAIa8EQADeCAAhxwQBANsIACHJBAEA2wgAIdQEIACgCQAh1gQAAOkJjQUi2QQBANsIACHmBAIA3AgAIecEAgDcCAAh9QQBANsIACH3BAAA4gn3BCL5BAAA4wn5BCL6BBAA3QgAIfwEAADkCfwEIv0EAgD2CAAh_wQAAOUJ_wQigAUBANsIACGBBQgA5gkAIYIFCADmCQAhgwUAAOcJACCEBUAA5ggAIYUFAQD5CAAhhgUQAPgIACGIBQAA6AmIBSKJBQEA-QgAIYoFAQD5CAAhiwUgAKAJACGNBQIA3AgAIR8FAADrCQAgEAAA7AkAIBEAAO0JACCuBEAA3ggAIa8EQADeCAAhxwQBANsIACHJBAEA2wgAIdQEIACgCQAh1gQAAOkJjQUi2QQBANsIACHmBAIA3AgAIecEAgDcCAAh9QQBANsIACH3BAAA4gn3BCL5BAAA4wn5BCL6BBAA3QgAIfwEAADkCfwEIv0EAgD2CAAh_wQAAOUJ_wQigAUBANsIACGBBQgA5gkAIYIFCADmCQAhgwUAAOcJACCEBUAA5ggAIYUFAQD5CAAhhgUQAPgIACGIBQAA6AmIBSKJBQEA-QgAIYoFAQD5CAAhiwUgAKAJACGNBQIA3AgAIR8FAACICgAgEAAAiQoAIBEAAIoKACCuBEAAAAABrwRAAAAAAccEAQAAAAHJBAEAAAAB1AQgAAAAAdYEAAAAjQUC2QQBAAAAAeYEAgAAAAHnBAIAAAAB9QQBAAAAAfcEAAAA9wQC-QQAAAD5BAL6BBAAAAAB_AQAAAD8BAL9BAIAAAAB_wQAAAD_BAKABQEAAAABgQUIAAAAAYIFCAAAAAGDBQAAhgoAIIQFQAAAAAGFBQEAAAABhgUQAAAAAYgFAAAAiAUCiQUBAAAAAYoFAQAAAAGLBSAAAAABjQUCAAAAARAFAACbCgAgrgRAAAAAAa8EQAAAAAHJBAEAAAAB0wQgAAAAAdYEAAAAoAUC2QQBAAAAAdsEQAAAAAH3BAAAAJoFApgFAQAAAAGaBQEAAAABmwUBAAAAAZwFAQAAAAGdBQIAAAABngUBAAAAAaAFAQAAAAECAAAABQAgJwAAiw0AIAMAAAAFACAnAACLDQAgKAAAig0AIAEgAACjDQAwAgAAAAUAICAAAIoNACACAAAA2AsAICAAAIkNACAPrgRAAN4IACGvBEAA3ggAIckEAQDbCAAh0wQgAKAJACHWBAAAlwqgBSLZBAEA-QgAIdsEQADmCAAh9wQAAJYKmgUimAUBANsIACGaBQEA2wgAIZsFAQD5CAAhnAUBAPkIACGdBQIA9ggAIZ4FAQD5CAAhoAUBAPkIACEQBQAAmQoAIK4EQADeCAAhrwRAAN4IACHJBAEA2wgAIdMEIACgCQAh1gQAAJcKoAUi2QQBAPkIACHbBEAA5ggAIfcEAACWCpoFIpgFAQDbCAAhmgUBANsIACGbBQEA-QgAIZwFAQD5CAAhnQUCAPYIACGeBQEA-QgAIaAFAQD5CAAhEAUAAJsKACCuBEAAAAABrwRAAAAAAckEAQAAAAHTBCAAAAAB1gQAAACgBQLZBAEAAAAB2wRAAAAAAfcEAAAAmgUCmAUBAAAAAZoFAQAAAAGbBQEAAAABnAUBAAAAAZ0FAgAAAAGeBQEAAAABoAUBAAAAAQQnAACDDQAwjgYAAIQNADCQBgAAhg0AIJQGAADUCwAwBCcAAPoMADCOBgAA-wwAMJAGAAD9DAAglAYAAMgLADAEJwAA8QwAMI4GAADyDAAwkAYAAPQMACCUBgAAvAsAMAQnAADoDAAwjgYAAOkMADCQBgAA6wwAIJQGAADyCQAwAycAAOMMACCOBgAA5AwAIJQGAACVAQAgBCcAANoMADCOBgAA2wwAMJAGAADdDAAglAYAAJwMADADJwAA1QwAII4GAADWDAAglAYAAMAGACAEJwAAzAwAMI4GAADNDAAwkAYAAM8MACCUBgAAsAsAMAQnAADDDAAwjgYAAMQMADCQBgAAxgwAIJQGAACWCwAwAycAAL4MACCOBgAAvwwAIJQGAADXAgAgAAAABQMAAKwJACDyBQAA3wgAIPMFAADfCAAg9AUAAN8IACD1BQAA3wgAIAYDAACsCQAgFgAAqAkAIBcAAKkJACAYAACqCQAgGQAAqwkAIMIEAADfCAAgAAMIAACsCQAgxQUAAN8IACDIBQAA3wgAIAUDAAClDAAg9QQAAN8IACCQBQAA3wgAIO8FAADfCAAg8AUAAN8IACAMAwAArAkAIAUAAJ8NACAQAACgDQAgEQAAmA0AIP0EAADfCAAggQUAAN8IACCCBQAA3wgAIIQFAADfCAAghQUAAN8IACCGBQAA3wgAIIkFAADfCAAgigUAAN8IACAJBAAAlg0AIAYAAKENACAMAACLDAAgDgAAjAwAIA8AAJcNACCBBQAA3wgAIIIFAADfCAAg1gUAAN8IACDpBQAA3wgAIAAHBQAAigwAIAwAAIsMACAOAACMDAAg9QQAAN8IACCBBQAA3wgAIIIFAADfCAAg6wUAAN8IACAQBgAAoQ0AIAcAAJ8NACAIAACsCQAgCgAAmw0AIPUEAADfCAAgrwUAAN8IACDEBQAA3wgAINYFAADfCAAg1wUAAN8IACDZBQAA3wgAINoFAADfCAAg2wUAAN8IACDcBQAA3wgAIN0FAADfCAAg3gUAAN8IACDfBQAA3wgAIA-uBEAAAAABrwRAAAAAAckEAQAAAAHTBCAAAAAB1gQAAACgBQLZBAEAAAAB2wRAAAAAAfcEAAAAmgUCmAUBAAAAAZoFAQAAAAGbBQEAAAABnAUBAAAAAZ0FAgAAAAGeBQEAAAABoAUBAAAAARyuBEAAAAABrwRAAAAAAccEAQAAAAHJBAEAAAAB1AQgAAAAAdYEAAAAjQUC2QQBAAAAAeYEAgAAAAHnBAIAAAAB9QQBAAAAAfcEAAAA9wQC-QQAAAD5BAL6BBAAAAAB_AQAAAD8BAL9BAIAAAAB_wQAAAD_BAKABQEAAAABgQUIAAAAAYIFCAAAAAGDBQAAhgoAIIQFQAAAAAGFBQEAAAABhgUQAAAAAYgFAAAAiAUCiQUBAAAAAYoFAQAAAAGLBSAAAAABjQUCAAAAARSuBEAAAAABrwRAAAAAAcgEAQAAAAHJBAEAAAABygQBAAAAAcsEAgAAAAHMBAIAAAABzQQCAAAAAc4EAgAAAAHPBAgAAAAB0AQAAMAJACDRBAAAwQkAINIEAgAAAAHTBCAAAAAB1AQgAAAAAdYEAAAA1gQC1wQBAAAAAdkEAQAAAAHaBAEAAAAB2wRAAAAAAQSuBEAAAAABrwRAAAAAAcYEAQAAAAHHBAEAAAABBcoFQAAAAAHLBUAAAAAB7AUBAAAAAe0FAQAAAAHuBSAAAAABD9YEAAAA2QUC9QQBAAAAAa8FAQAAAAHKBUAAAAABywVAAAAAAdAFAQAAAAHWBQEAAAAB1wUBAAAAAdkFCAAAAAHaBQgAAAAB2wUIAAAAAdwFgAAAAAHdBYAAAAAB3gUBAAAAAd8FQAAAAAEK1gQAAADVBQKrBQIAAAABygVAAAAAAcsFQAAAAAHPBQEAAAAB0AUBAAAAAdEFAQAAAAHSBQEAAAAB0wUBAAAAAdUFQAAAAAEdBAAAjA0AIAoAAJQNACAMAACTDQAgDgAAjg0AIA8AAI0NACARAACPDQAgFAAAkQ0AIBUAAJINACAaAACVDQAgkAUBAAAAAcQFAQAAAAHKBUAAAAABywVAAAAAAe8FAQAAAAH6BQEAAAAB-wUBAAAAAfwFAQAAAAH9BQEAAAAB_gUBAAAAAf8FIAAAAAGABiAAAAABggYAAACCBgKDBgEAAAABhAZAAAAAAYUGQAAAAAGGBgEAAAABhwYBAAAAAYgGQAAAAAGJBkAAAAABAgAAAAEAICcAAKoNACADAAAABwAgJwAAqg0AICgAAK4NACAfAAAABwAgBAAAtAwAIAoAALwMACAMAAC7DAAgDgAAtgwAIA8AALUMACARAAC3DAAgFAAAuQwAIBUAALoMACAaAAC9DAAgIAAArg0AIJAFAQDbCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAh7wUBAPkIACH6BQEA2wgAIfsFAQDbCAAh_AUBAPkIACH9BQEA-QgAIf4FAQD5CAAh_wUgAKAJACGABiAAoAkAIYIGAACzDIIGIoMGAQD5CAAhhAZAAOYIACGFBkAA5ggAIYYGAQD5CAAhhwYBAPkIACGIBkAA5ggAIYkGQADmCAAhHQQAALQMACAKAAC8DAAgDAAAuwwAIA4AALYMACAPAAC1DAAgEQAAtwwAIBQAALkMACAVAAC6DAAgGgAAvQwAIJAFAQDbCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAh7wUBAPkIACH6BQEA2wgAIfsFAQDbCAAh_AUBAPkIACH9BQEA-QgAIf4FAQD5CAAh_wUgAKAJACGABiAAoAkAIYIGAACzDIIGIoMGAQD5CAAhhAZAAOYIACGFBkAA5ggAIYYGAQD5CAAhhwYBAPkIACGIBkAA5ggAIYkGQADmCAAhBcQFAQAAAAHKBUAAAAABywVAAAAAAewFAQAAAAHuBSAAAAABHQQAAIwNACAKAACUDQAgDAAAkw0AIA4AAI4NACAPAACNDQAgEQAAjw0AIBIAAJANACAVAACSDQAgGgAAlQ0AIJAFAQAAAAHEBQEAAAABygVAAAAAAcsFQAAAAAHvBQEAAAAB-gUBAAAAAfsFAQAAAAH8BQEAAAAB_QUBAAAAAf4FAQAAAAH_BSAAAAABgAYgAAAAAYIGAAAAggYCgwYBAAAAAYQGQAAAAAGFBkAAAAABhgYBAAAAAYcGAQAAAAGIBkAAAAABiQZAAAAAAQIAAAABACAnAACwDQAgCfUEAQAAAAGQBQEAAAABrwUBAAAAAcoFQAAAAAHLBUAAAAAB7QUBAAAAAe4FIAAAAAHvBQEAAAAB8AUBAAAAAQIAAACtAQAgJwAAsg0AIAMAAAAHACAnAACwDQAgKAAAtg0AIB8AAAAHACAEAAC0DAAgCgAAvAwAIAwAALsMACAOAAC2DAAgDwAAtQwAIBEAALcMACASAAC4DAAgFQAAugwAIBoAAL0MACAgAAC2DQAgkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACEdBAAAtAwAIAoAALwMACAMAAC7DAAgDgAAtgwAIA8AALUMACARAAC3DAAgEgAAuAwAIBUAALoMACAaAAC9DAAgkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACEDAAAAsAEAICcAALINACAoAAC5DQAgCwAAALABACAgAAC5DQAg9QQBAPkIACGQBQEA-QgAIa8FAQDbCAAhygVAAN4IACHLBUAA3ggAIe0FAQDbCAAh7gUgAKAJACHvBQEA-QgAIfAFAQD5CAAhCfUEAQD5CAAhkAUBAPkIACGvBQEA2wgAIcoFQADeCAAhywVAAN4IACHtBQEA2wgAIe4FIACgCQAh7wUBAPkIACHwBQEA-QgAIQqBBQgAAAABggUIAAAAAcoFQAAAAAHLBUAAAAAB1wUBAAAAAeYFAQAAAAHnBQEAAAAB6AUBAAAAAekFAQAAAAHqBYAAAAABD9YEAAAA2QUC9QQBAAAAAa8FAQAAAAHEBQEAAAABygVAAAAAAcsFQAAAAAHQBQEAAAAB1wUBAAAAAdkFCAAAAAHaBQgAAAAB2wUIAAAAAdwFgAAAAAHdBYAAAAAB3gUBAAAAAd8FQAAAAAEUrgRAAAAAAa8EQAAAAAHIBAEAAAAByQQBAAAAAcoEAQAAAAHLBAIAAAABzAQCAAAAAc0EAgAAAAHOBAIAAAABzwQIAAAAAdAEAADACQAg0QQAAMEJACDSBAIAAAAB0wQgAAAAAdQEIAAAAAHWBAAAANYEAtcEAQAAAAHYBAEAAAAB2QQBAAAAAdsEQAAAAAEMDAAAiAwAIA4AAIkMACD1BAEAAAABgQUIAAAAAYIFCAAAAAGvBQEAAAABtAUBAAAAAcoFQAAAAAHLBUAAAAAB1gUBAAAAAeoFgAAAAAHrBQEAAAABAgAAANwBACAnAAC9DQAgD64EQAAAAAGvBEAAAAAByQQBAAAAAdMEIAAAAAHWBAAAAKAFAtgEAQAAAAHbBEAAAAAB9wQAAACaBQKYBQEAAAABmgUBAAAAAZsFAQAAAAGcBQEAAAABnQUCAAAAAZ4FAQAAAAGgBQEAAAABHK4EQAAAAAGvBEAAAAABxwQBAAAAAckEAQAAAAHUBCAAAAAB1gQAAACNBQLmBAIAAAAB5wQCAAAAAfUEAQAAAAH3BAAAAPcEAvkEAAAA-QQC-gQQAAAAAfwEAAAA_AQC_QQCAAAAAf8EAAAA_wQCgAUBAAAAAYEFCAAAAAGCBQgAAAABgwUAAIYKACCEBUAAAAABhQUBAAAAAYYFEAAAAAGIBQAAAIgFAokFAQAAAAGKBQEAAAABiwUgAAAAAY0FAgAAAAGOBQEAAAABFK4EQAAAAAGvBEAAAAAByAQBAAAAAckEAQAAAAHKBAEAAAABywQCAAAAAcwEAgAAAAHNBAIAAAABzgQCAAAAAc8ECAAAAAHQBAAAwAkAINEEAADBCQAg0gQCAAAAAdMEIAAAAAHUBCAAAAAB1gQAAADWBALXBAEAAAAB2AQBAAAAAdoEAQAAAAHbBEAAAAABD9YEAAAA2QUC9QQBAAAAAa8FAQAAAAHEBQEAAAABygVAAAAAAcsFQAAAAAHQBQEAAAAB1gUBAAAAAdkFCAAAAAHaBQgAAAAB2wUIAAAAAdwFgAAAAAHdBYAAAAAB3gUBAAAAAd8FQAAAAAEDAAAADAAgJwAAvQ0AICgAAMUNACAOAAAADAAgDAAA5wsAIA4AAOgLACAgAADFDQAg9QQBAPkIACGBBQgA5gkAIYIFCADmCQAhrwUBANsIACG0BQEA2wgAIcoFQADeCAAhywVAAN4IACHWBQEA2wgAIeoFgAAAAAHrBQEA-QgAIQwMAADnCwAgDgAA6AsAIPUEAQD5CAAhgQUIAOYJACGCBQgA5gkAIa8FAQDbCAAhtAUBANsIACHKBUAA3ggAIcsFQADeCAAh1gUBANsIACHqBYAAAAAB6wUBAPkIACEdBAAAjA0AIAoAAJQNACAOAACODQAgDwAAjQ0AIBEAAI8NACASAACQDQAgFAAAkQ0AIBUAAJINACAaAACVDQAgkAUBAAAAAcQFAQAAAAHKBUAAAAABywVAAAAAAe8FAQAAAAH6BQEAAAAB-wUBAAAAAfwFAQAAAAH9BQEAAAAB_gUBAAAAAf8FIAAAAAGABiAAAAABggYAAACCBgKDBgEAAAABhAZAAAAAAYUGQAAAAAGGBgEAAAABhwYBAAAAAYgGQAAAAAGJBkAAAAABAgAAAAEAICcAAMYNACAPBAAA3AsAIAYAAN0LACAOAADfCwAgDwAA3gsAIIEFCAAAAAGCBQgAAAABygVAAAAAAcsFQAAAAAHWBQEAAAAB1wUBAAAAAeYFAQAAAAHnBQEAAAAB6AUBAAAAAekFAQAAAAHqBYAAAAABAgAAAA8AICcAAMgNACAMBQAAhwwAIA4AAIkMACD1BAEAAAABgQUIAAAAAYIFCAAAAAGvBQEAAAABtAUBAAAAAcoFQAAAAAHLBUAAAAAB1gUBAAAAAeoFgAAAAAHrBQEAAAABAgAAANwBACAnAADKDQAgCtYEAAAA1QUCqwUCAAAAAcQFAQAAAAHKBUAAAAABywVAAAAAAc8FAQAAAAHRBQEAAAAB0gUBAAAAAdMFAQAAAAHVBUAAAAABAwAAAAcAICcAAMYNACAoAADPDQAgHwAAAAcAIAQAALQMACAKAAC8DAAgDgAAtgwAIA8AALUMACARAAC3DAAgEgAAuAwAIBQAALkMACAVAAC6DAAgGgAAvQwAICAAAM8NACCQBQEA2wgAIcQFAQDbCAAhygVAAN4IACHLBUAA3ggAIe8FAQD5CAAh-gUBANsIACH7BQEA2wgAIfwFAQD5CAAh_QUBAPkIACH-BQEA-QgAIf8FIACgCQAhgAYgAKAJACGCBgAAswyCBiKDBgEA-QgAIYQGQADmCAAhhQZAAOYIACGGBgEA-QgAIYcGAQD5CAAhiAZAAOYIACGJBkAA5ggAIR0EAAC0DAAgCgAAvAwAIA4AALYMACAPAAC1DAAgEQAAtwwAIBIAALgMACAUAAC5DAAgFQAAugwAIBoAAL0MACCQBQEA2wgAIcQFAQDbCAAhygVAAN4IACHLBUAA3ggAIe8FAQD5CAAh-gUBANsIACH7BQEA2wgAIfwFAQD5CAAh_QUBAPkIACH-BQEA-QgAIf8FIACgCQAhgAYgAKAJACGCBgAAswyCBiKDBgEA-QgAIYQGQADmCAAhhQZAAOYIACGGBgEA-QgAIYcGAQD5CAAhiAZAAOYIACGJBkAA5ggAIQMAAAAJACAnAADIDQAgKAAA0g0AIBEAAAAJACAEAACnCwAgBgAAqAsAIA4AAKoLACAPAACpCwAgIAAA0g0AIIEFCADmCQAhggUIAOYJACHKBUAA3ggAIcsFQADeCAAh1gUBAPkIACHXBQEA2wgAIeYFAQDbCAAh5wUBANsIACHoBQEA2wgAIekFAQD5CAAh6gWAAAAAAQ8EAACnCwAgBgAAqAsAIA4AAKoLACAPAACpCwAggQUIAOYJACGCBQgA5gkAIcoFQADeCAAhywVAAN4IACHWBQEA-QgAIdcFAQDbCAAh5gUBANsIACHnBQEA2wgAIegFAQDbCAAh6QUBAPkIACHqBYAAAAABAwAAAAwAICcAAMoNACAoAADVDQAgDgAAAAwAIAUAAOYLACAOAADoCwAgIAAA1Q0AIPUEAQD5CAAhgQUIAOYJACGCBQgA5gkAIa8FAQDbCAAhtAUBANsIACHKBUAA3ggAIcsFQADeCAAh1gUBANsIACHqBYAAAAAB6wUBAPkIACEMBQAA5gsAIA4AAOgLACD1BAEA-QgAIYEFCADmCQAhggUIAOYJACGvBQEA2wgAIbQFAQDbCAAhygVAAN4IACHLBUAA3ggAIdYFAQDbCAAh6gWAAAAAAesFAQD5CAAhEwYAAJ4LACAHAACfCwAgCAAAoAsAINYEAAAA2QUC9QQBAAAAAa8FAQAAAAHEBQEAAAABygVAAAAAAcsFQAAAAAHQBQEAAAAB1gUBAAAAAdcFAQAAAAHZBQgAAAAB2gUIAAAAAdsFCAAAAAHcBYAAAAAB3QWAAAAAAd4FAQAAAAHfBUAAAAABAgAAABMAICcAANYNACAdBAAAjA0AIAwAAJMNACAOAACODQAgDwAAjQ0AIBEAAI8NACASAACQDQAgFAAAkQ0AIBUAAJINACAaAACVDQAgkAUBAAAAAcQFAQAAAAHKBUAAAAABywVAAAAAAe8FAQAAAAH6BQEAAAAB-wUBAAAAAfwFAQAAAAH9BQEAAAAB_gUBAAAAAf8FIAAAAAGABiAAAAABggYAAACCBgKDBgEAAAABhAZAAAAAAYUGQAAAAAGGBgEAAAABhwYBAAAAAYgGQAAAAAGJBkAAAAABAgAAAAEAICcAANgNACADAAAAEQAgJwAA1g0AICgAANwNACAVAAAAEQAgBgAAjgsAIAcAAI8LACAIAACQCwAgIAAA3A0AINYEAACNC9kFIvUEAQD5CAAhrwUBAPkIACHEBQEA-QgAIcoFQADeCAAhywVAAN4IACHQBQEA2wgAIdYFAQD5CAAh1wUBAPkIACHZBQgA5gkAIdoFCADmCQAh2wUIAOYJACHcBYAAAAAB3QWAAAAAAd4FAQD5CAAh3wVAAOYIACETBgAAjgsAIAcAAI8LACAIAACQCwAg1gQAAI0L2QUi9QQBAPkIACGvBQEA-QgAIcQFAQD5CAAhygVAAN4IACHLBUAA3ggAIdAFAQDbCAAh1gUBAPkIACHXBQEA-QgAIdkFCADmCQAh2gUIAOYJACHbBQgA5gkAIdwFgAAAAAHdBYAAAAAB3gUBAPkIACHfBUAA5ggAIQMAAAAHACAnAADYDQAgKAAA3w0AIB8AAAAHACAEAAC0DAAgDAAAuwwAIA4AALYMACAPAAC1DAAgEQAAtwwAIBIAALgMACAUAAC5DAAgFQAAugwAIBoAAL0MACAgAADfDQAgkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACEdBAAAtAwAIAwAALsMACAOAAC2DAAgDwAAtQwAIBEAALcMACASAAC4DAAgFAAAuQwAIBUAALoMACAaAAC9DAAgkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACEdBAAAjA0AIAoAAJQNACAMAACTDQAgDgAAjg0AIA8AAI0NACARAACPDQAgEgAAkA0AIBQAAJENACAVAACSDQAgkAUBAAAAAcQFAQAAAAHKBUAAAAABywVAAAAAAe8FAQAAAAH6BQEAAAAB-wUBAAAAAfwFAQAAAAH9BQEAAAAB_gUBAAAAAf8FIAAAAAGABiAAAAABggYAAACCBgKDBgEAAAABhAZAAAAAAYUGQAAAAAGGBgEAAAABhwYBAAAAAYgGQAAAAAGJBkAAAAABAgAAAAEAICcAAOANACADAAAABwAgJwAA4A0AICgAAOQNACAfAAAABwAgBAAAtAwAIAoAALwMACAMAAC7DAAgDgAAtgwAIA8AALUMACARAAC3DAAgEgAAuAwAIBQAALkMACAVAAC6DAAgIAAA5A0AIJAFAQDbCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAh7wUBAPkIACH6BQEA2wgAIfsFAQDbCAAh_AUBAPkIACH9BQEA-QgAIf4FAQD5CAAh_wUgAKAJACGABiAAoAkAIYIGAACzDIIGIoMGAQD5CAAhhAZAAOYIACGFBkAA5ggAIYYGAQD5CAAhhwYBAPkIACGIBkAA5ggAIYkGQADmCAAhHQQAALQMACAKAAC8DAAgDAAAuwwAIA4AALYMACAPAAC1DAAgEQAAtwwAIBIAALgMACAUAAC5DAAgFQAAugwAIJAFAQDbCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAh7wUBAPkIACH6BQEA2wgAIfsFAQDbCAAh_AUBAPkIACH9BQEA-QgAIf4FAQD5CAAh_wUgAKAJACGABiAAoAkAIYIGAACzDIIGIoMGAQD5CAAhhAZAAOYIACGFBkAA5ggAIYYGAQD5CAAhhwYBAPkIACGIBkAA5ggAIYkGQADmCAAhDQMAAKcJACAXAACkCQAgGAAApQkAIBkAAKYJACCuBEAAAAABrwRAAAAAAbsEAQAAAAG8BAEAAAABvQQCAAAAAb8EAAAAvwQCwAQCAAAAAcEEAgAAAAHCBEAAAAABAgAAAMAGACAnAADlDQAgAwAAAEUAICcAAOUNACAoAADpDQAgDwAAAEUAIAMAAOsIACAXAADoCAAgGAAA6QgAIBkAAOoIACAgAADpDQAgrgRAAN4IACGvBEAA3ggAIbsEAQDbCAAhvAQBANsIACG9BAIA3AgAIb8EAADlCL8EIsAEAgDcCAAhwQQCANwIACHCBEAA5ggAIQ0DAADrCAAgFwAA6AgAIBgAAOkIACAZAADqCAAgrgRAAN4IACGvBEAA3ggAIbsEAQDbCAAhvAQBANsIACG9BAIA3AgAIb8EAADlCL8EIsAEAgDcCAAhwQQCANwIACHCBEAA5ggAIQ2uBEAAAAABrwRAAAAAAckEAQAAAAHKBAEAAAAB1gQAAAC6BQLbBEAAAAABtAUBAAAAAbUFAQAAAAG2BQEAAAABtwUBAAAAAbgFAgAAAAG7BQEAAAABvAUBAAAAAQauBEAAAAABrwRAAAAAAfUEAQAAAAGvBQEAAAABtAUBAAAAAb0FAQAAAAECAAAAhQMAICcAAOsNACADAAAAiwMAICcAAOsNACAoAADvDQAgCAAAAIsDACAgAADvDQAgrgRAAN4IACGvBEAA3ggAIfUEAQD5CAAhrwUBANsIACG0BQEA2wgAIb0FAQDbCAAhBq4EQADeCAAhrwRAAN4IACH1BAEA-QgAIa8FAQDbCAAhtAUBANsIACG9BQEA2wgAIQ0DAACnCQAgFgAAowkAIBgAAKUJACAZAACmCQAgrgRAAAAAAa8EQAAAAAG7BAEAAAABvAQBAAAAAb0EAgAAAAG_BAAAAL8EAsAEAgAAAAHBBAIAAAABwgRAAAAAAQIAAADABgAgJwAA8A0AIAMAAABFACAnAADwDQAgKAAA9A0AIA8AAABFACADAADrCAAgFgAA5wgAIBgAAOkIACAZAADqCAAgIAAA9A0AIK4EQADeCAAhrwRAAN4IACG7BAEA2wgAIbwEAQDbCAAhvQQCANwIACG_BAAA5Qi_BCLABAIA3AgAIcEEAgDcCAAhwgRAAOYIACENAwAA6wgAIBYAAOcIACAYAADpCAAgGQAA6ggAIK4EQADeCAAhrwRAAN4IACG7BAEA2wgAIbwEAQDbCAAhvQQCANwIACG_BAAA5Qi_BCLABAIA3AgAIcEEAgDcCAAhwgRAAOYIACENAwAApwkAIBYAAKMJACAXAACkCQAgGQAApgkAIK4EQAAAAAGvBEAAAAABuwQBAAAAAbwEAQAAAAG9BAIAAAABvwQAAAC_BALABAIAAAABwQQCAAAAAcIEQAAAAAECAAAAwAYAICcAAPUNACADAAAARQAgJwAA9Q0AICgAAPkNACAPAAAARQAgAwAA6wgAIBYAAOcIACAXAADoCAAgGQAA6ggAICAAAPkNACCuBEAA3ggAIa8EQADeCAAhuwQBANsIACG8BAEA2wgAIb0EAgDcCAAhvwQAAOUIvwQiwAQCANwIACHBBAIA3AgAIcIEQADmCAAhDQMAAOsIACAWAADnCAAgFwAA6AgAIBkAAOoIACCuBEAA3ggAIa8EQADeCAAhuwQBANsIACG8BAEA2wgAIb0EAgDcCAAhvwQAAOUIvwQiwAQCANwIACHBBAIA3AgAIcIEQADmCAAhDwYAAN0LACAMAADgCwAgDgAA3wsAIA8AAN4LACCBBQgAAAABggUIAAAAAcoFQAAAAAHLBUAAAAAB1gUBAAAAAdcFAQAAAAHmBQEAAAAB5wUBAAAAAegFAQAAAAHpBQEAAAAB6gWAAAAAAQIAAAAPACAnAAD6DQAgHQoAAJQNACAMAACTDQAgDgAAjg0AIA8AAI0NACARAACPDQAgEgAAkA0AIBQAAJENACAVAACSDQAgGgAAlQ0AIJAFAQAAAAHEBQEAAAABygVAAAAAAcsFQAAAAAHvBQEAAAAB-gUBAAAAAfsFAQAAAAH8BQEAAAAB_QUBAAAAAf4FAQAAAAH_BSAAAAABgAYgAAAAAYIGAAAAggYCgwYBAAAAAYQGQAAAAAGFBkAAAAABhgYBAAAAAYcGAQAAAAGIBkAAAAABiQZAAAAAAQIAAAABACAnAAD8DQAgAwAAAAkAICcAAPoNACAoAACADgAgEQAAAAkAIAYAAKgLACAMAACrCwAgDgAAqgsAIA8AAKkLACAgAACADgAggQUIAOYJACGCBQgA5gkAIcoFQADeCAAhywVAAN4IACHWBQEA-QgAIdcFAQDbCAAh5gUBANsIACHnBQEA2wgAIegFAQDbCAAh6QUBAPkIACHqBYAAAAABDwYAAKgLACAMAACrCwAgDgAAqgsAIA8AAKkLACCBBQgA5gkAIYIFCADmCQAhygVAAN4IACHLBUAA3ggAIdYFAQD5CAAh1wUBANsIACHmBQEA2wgAIecFAQDbCAAh6AUBANsIACHpBQEA-QgAIeoFgAAAAAEDAAAABwAgJwAA_A0AICgAAIMOACAfAAAABwAgCgAAvAwAIAwAALsMACAOAAC2DAAgDwAAtQwAIBEAALcMACASAAC4DAAgFAAAuQwAIBUAALoMACAaAAC9DAAgIAAAgw4AIJAFAQDbCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAh7wUBAPkIACH6BQEA2wgAIfsFAQDbCAAh_AUBAPkIACH9BQEA-QgAIf4FAQD5CAAh_wUgAKAJACGABiAAoAkAIYIGAACzDIIGIoMGAQD5CAAhhAZAAOYIACGFBkAA5ggAIYYGAQD5CAAhhwYBAPkIACGIBkAA5ggAIYkGQADmCAAhHQoAALwMACAMAAC7DAAgDgAAtgwAIA8AALUMACARAAC3DAAgEgAAuAwAIBQAALkMACAVAAC6DAAgGgAAvQwAIJAFAQDbCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAh7wUBAPkIACH6BQEA2wgAIfsFAQDbCAAh_AUBAPkIACH9BQEA-QgAIf4FAQD5CAAh_wUgAKAJACGABiAAoAkAIYIGAACzDIIGIoMGAQD5CAAhhAZAAOYIACGFBkAA5ggAIYYGAQD5CAAhhwYBAPkIACGIBkAA5ggAIYkGQADmCAAhDwQAANwLACAGAADdCwAgDAAA4AsAIA4AAN8LACCBBQgAAAABggUIAAAAAcoFQAAAAAHLBUAAAAAB1gUBAAAAAdcFAQAAAAHmBQEAAAAB5wUBAAAAAegFAQAAAAHpBQEAAAAB6gWAAAAAAQIAAAAPACAnAACEDgAgHQQAAIwNACAKAACUDQAgDAAAkw0AIA4AAI4NACARAACPDQAgEgAAkA0AIBQAAJENACAVAACSDQAgGgAAlQ0AIJAFAQAAAAHEBQEAAAABygVAAAAAAcsFQAAAAAHvBQEAAAAB-gUBAAAAAfsFAQAAAAH8BQEAAAAB_QUBAAAAAf4FAQAAAAH_BSAAAAABgAYgAAAAAYIGAAAAggYCgwYBAAAAAYQGQAAAAAGFBkAAAAABhgYBAAAAAYcGAQAAAAGIBkAAAAABiQZAAAAAAQIAAAABACAnAACGDgAgBq4EQAAAAAGvBEAAAAAB8QQBAAAAAfIEAQAAAAHzBAEAAAAB9AQCAAAAAQSuBEAAAAABrwRAAAAAAbwEAQAAAAHGBAEAAAABAwAAAAkAICcAAIQOACAoAACMDgAgEQAAAAkAIAQAAKcLACAGAACoCwAgDAAAqwsAIA4AAKoLACAgAACMDgAggQUIAOYJACGCBQgA5gkAIcoFQADeCAAhywVAAN4IACHWBQEA-QgAIdcFAQDbCAAh5gUBANsIACHnBQEA2wgAIegFAQDbCAAh6QUBAPkIACHqBYAAAAABDwQAAKcLACAGAACoCwAgDAAAqwsAIA4AAKoLACCBBQgA5gkAIYIFCADmCQAhygVAAN4IACHLBUAA3ggAIdYFAQD5CAAh1wUBANsIACHmBQEA2wgAIecFAQDbCAAh6AUBANsIACHpBQEA-QgAIeoFgAAAAAEDAAAABwAgJwAAhg4AICgAAI8OACAfAAAABwAgBAAAtAwAIAoAALwMACAMAAC7DAAgDgAAtgwAIBEAALcMACASAAC4DAAgFAAAuQwAIBUAALoMACAaAAC9DAAgIAAAjw4AIJAFAQDbCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAh7wUBAPkIACH6BQEA2wgAIfsFAQDbCAAh_AUBAPkIACH9BQEA-QgAIf4FAQD5CAAh_wUgAKAJACGABiAAoAkAIYIGAACzDIIGIoMGAQD5CAAhhAZAAOYIACGFBkAA5ggAIYYGAQD5CAAhhwYBAPkIACGIBkAA5ggAIYkGQADmCAAhHQQAALQMACAKAAC8DAAgDAAAuwwAIA4AALYMACARAAC3DAAgEgAAuAwAIBQAALkMACAVAAC6DAAgGgAAvQwAIJAFAQDbCAAhxAUBANsIACHKBUAA3ggAIcsFQADeCAAh7wUBAPkIACH6BQEA2wgAIfsFAQDbCAAh_AUBAPkIACH9BQEA-QgAIf4FAQD5CAAh_wUgAKAJACGABiAAoAkAIYIGAACzDIIGIoMGAQD5CAAhhAZAAOYIACGFBkAA5ggAIYYGAQD5CAAhhwYBAPkIACGIBkAA5ggAIYkGQADmCAAhIAMAAIcKACAFAACICgAgEQAAigoAIK4EQAAAAAGvBEAAAAABxwQBAAAAAckEAQAAAAHUBCAAAAAB1gQAAACNBQLZBAEAAAAB5gQCAAAAAecEAgAAAAH1BAEAAAAB9wQAAAD3BAL5BAAAAPkEAvoEEAAAAAH8BAAAAPwEAv0EAgAAAAH_BAAAAP8EAoAFAQAAAAGBBQgAAAABggUIAAAAAYMFAACGCgAghAVAAAAAAYUFAQAAAAGGBRAAAAABiAUAAACIBQKJBQEAAAABigUBAAAAAYsFIAAAAAGNBQIAAAABjgUBAAAAAQIAAAAoACAnAACQDgAgAwAAACYAICcAAJAOACAoAACUDgAgIgAAACYAIAMAAOoJACAFAADrCQAgEQAA7QkAICAAAJQOACCuBEAA3ggAIa8EQADeCAAhxwQBANsIACHJBAEA2wgAIdQEIACgCQAh1gQAAOkJjQUi2QQBANsIACHmBAIA3AgAIecEAgDcCAAh9QQBANsIACH3BAAA4gn3BCL5BAAA4wn5BCL6BBAA3QgAIfwEAADkCfwEIv0EAgD2CAAh_wQAAOUJ_wQigAUBANsIACGBBQgA5gkAIYIFCADmCQAhgwUAAOcJACCEBUAA5ggAIYUFAQD5CAAhhgUQAPgIACGIBQAA6AmIBSKJBQEA-QgAIYoFAQD5CAAhiwUgAKAJACGNBQIA3AgAIY4FAQDbCAAhIAMAAOoJACAFAADrCQAgEQAA7QkAIK4EQADeCAAhrwRAAN4IACHHBAEA2wgAIckEAQDbCAAh1AQgAKAJACHWBAAA6QmNBSLZBAEA2wgAIeYEAgDcCAAh5wQCANwIACH1BAEA2wgAIfcEAADiCfcEIvkEAADjCfkEIvoEEADdCAAh_AQAAOQJ_AQi_QQCAPYIACH_BAAA5Qn_BCKABQEA2wgAIYEFCADmCQAhggUIAOYJACGDBQAA5wkAIIQFQADmCAAhhQUBAPkIACGGBRAA-AgAIYgFAADoCYgFIokFAQD5CAAhigUBAPkIACGLBSAAoAkAIY0FAgDcCAAhjgUBANsIACENAwAApwkAIBYAAKMJACAXAACkCQAgGAAApQkAIK4EQAAAAAGvBEAAAAABuwQBAAAAAbwEAQAAAAG9BAIAAAABvwQAAAC_BALABAIAAAABwQQCAAAAAcIEQAAAAAECAAAAwAYAICcAAJUOACADAAAARQAgJwAAlQ4AICgAAJkOACAPAAAARQAgAwAA6wgAIBYAAOcIACAXAADoCAAgGAAA6QgAICAAAJkOACCuBEAA3ggAIa8EQADeCAAhuwQBANsIACG8BAEA2wgAIb0EAgDcCAAhvwQAAOUIvwQiwAQCANwIACHBBAIA3AgAIcIEQADmCAAhDQMAAOsIACAWAADnCAAgFwAA6AgAIBgAAOkIACCuBEAA3ggAIa8EQADeCAAhuwQBANsIACG8BAEA2wgAIb0EAgDcCAAhvwQAAOUIvwQiwAQCANwIACHBBAIA3AgAIcIEQADmCAAhDwQAANwLACAGAADdCwAgDAAA4AsAIA8AAN4LACCBBQgAAAABggUIAAAAAcoFQAAAAAHLBUAAAAAB1gUBAAAAAdcFAQAAAAHmBQEAAAAB5wUBAAAAAegFAQAAAAHpBQEAAAAB6gWAAAAAAQIAAAAPACAnAACaDgAgDAUAAIcMACAMAACIDAAg9QQBAAAAAYEFCAAAAAGCBQgAAAABrwUBAAAAAbQFAQAAAAHKBUAAAAABywVAAAAAAdYFAQAAAAHqBYAAAAAB6wUBAAAAAQIAAADcAQAgJwAAnA4AIB0EAACMDQAgCgAAlA0AIAwAAJMNACAPAACNDQAgEQAAjw0AIBIAAJANACAUAACRDQAgFQAAkg0AIBoAAJUNACCQBQEAAAABxAUBAAAAAcoFQAAAAAHLBUAAAAAB7wUBAAAAAfoFAQAAAAH7BQEAAAAB_AUBAAAAAf0FAQAAAAH-BQEAAAAB_wUgAAAAAYAGIAAAAAGCBgAAAIIGAoMGAQAAAAGEBkAAAAABhQZAAAAAAYYGAQAAAAGHBgEAAAABiAZAAAAAAYkGQAAAAAECAAAAAQAgJwAAng4AIAMAAAAJACAnAACaDgAgKAAAog4AIBEAAAAJACAEAACnCwAgBgAAqAsAIAwAAKsLACAPAACpCwAgIAAAog4AIIEFCADmCQAhggUIAOYJACHKBUAA3ggAIcsFQADeCAAh1gUBAPkIACHXBQEA2wgAIeYFAQDbCAAh5wUBANsIACHoBQEA2wgAIekFAQD5CAAh6gWAAAAAAQ8EAACnCwAgBgAAqAsAIAwAAKsLACAPAACpCwAggQUIAOYJACGCBQgA5gkAIcoFQADeCAAhywVAAN4IACHWBQEA-QgAIdcFAQDbCAAh5gUBANsIACHnBQEA2wgAIegFAQDbCAAh6QUBAPkIACHqBYAAAAABAwAAAAwAICcAAJwOACAoAAClDgAgDgAAAAwAIAUAAOYLACAMAADnCwAgIAAApQ4AIPUEAQD5CAAhgQUIAOYJACGCBQgA5gkAIa8FAQDbCAAhtAUBANsIACHKBUAA3ggAIcsFQADeCAAh1gUBANsIACHqBYAAAAAB6wUBAPkIACEMBQAA5gsAIAwAAOcLACD1BAEA-QgAIYEFCADmCQAhggUIAOYJACGvBQEA2wgAIbQFAQDbCAAhygVAAN4IACHLBUAA3ggAIdYFAQDbCAAh6gWAAAAAAesFAQD5CAAhAwAAAAcAICcAAJ4OACAoAACoDgAgHwAAAAcAIAQAALQMACAKAAC8DAAgDAAAuwwAIA8AALUMACARAAC3DAAgEgAAuAwAIBQAALkMACAVAAC6DAAgGgAAvQwAICAAAKgOACCQBQEA2wgAIcQFAQDbCAAhygVAAN4IACHLBUAA3ggAIe8FAQD5CAAh-gUBANsIACH7BQEA2wgAIfwFAQD5CAAh_QUBAPkIACH-BQEA-QgAIf8FIACgCQAhgAYgAKAJACGCBgAAswyCBiKDBgEA-QgAIYQGQADmCAAhhQZAAOYIACGGBgEA-QgAIYcGAQD5CAAhiAZAAOYIACGJBkAA5ggAIR0EAAC0DAAgCgAAvAwAIAwAALsMACAPAAC1DAAgEQAAtwwAIBIAALgMACAUAAC5DAAgFQAAugwAIBoAAL0MACCQBQEA2wgAIcQFAQDbCAAhygVAAN4IACHLBUAA3ggAIe8FAQD5CAAh-gUBANsIACH7BQEA2wgAIfwFAQD5CAAh_QUBAPkIACH-BQEA-QgAIf8FIACgCQAhgAYgAKAJACGCBgAAswyCBiKDBgEA-QgAIYQGQADmCAAhhQZAAOYIACGGBgEA-QgAIYcGAQD5CAAhiAZAAOYIACGJBkAA5ggAIR0EAACMDQAgCgAAlA0AIAwAAJMNACAOAACODQAgDwAAjQ0AIBIAAJANACAUAACRDQAgFQAAkg0AIBoAAJUNACCQBQEAAAABxAUBAAAAAcoFQAAAAAHLBUAAAAAB7wUBAAAAAfoFAQAAAAH7BQEAAAAB_AUBAAAAAf0FAQAAAAH-BQEAAAAB_wUgAAAAAYAGIAAAAAGCBgAAAIIGAoMGAQAAAAGEBkAAAAABhQZAAAAAAYYGAQAAAAGHBgEAAAABiAZAAAAAAYkGQAAAAAECAAAAAQAgJwAAqQ4AICADAACHCgAgBQAAiAoAIBAAAIkKACCuBEAAAAABrwRAAAAAAccEAQAAAAHJBAEAAAAB1AQgAAAAAdYEAAAAjQUC2QQBAAAAAeYEAgAAAAHnBAIAAAAB9QQBAAAAAfcEAAAA9wQC-QQAAAD5BAL6BBAAAAAB_AQAAAD8BAL9BAIAAAAB_wQAAAD_BAKABQEAAAABgQUIAAAAAYIFCAAAAAGDBQAAhgoAIIQFQAAAAAGFBQEAAAABhgUQAAAAAYgFAAAAiAUCiQUBAAAAAYoFAQAAAAGLBSAAAAABjQUCAAAAAY4FAQAAAAECAAAAKAAgJwAAqw4AIAMAAAAHACAnAACpDgAgKAAArw4AIB8AAAAHACAEAAC0DAAgCgAAvAwAIAwAALsMACAOAAC2DAAgDwAAtQwAIBIAALgMACAUAAC5DAAgFQAAugwAIBoAAL0MACAgAACvDgAgkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACEdBAAAtAwAIAoAALwMACAMAAC7DAAgDgAAtgwAIA8AALUMACASAAC4DAAgFAAAuQwAIBUAALoMACAaAAC9DAAgkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACEDAAAAJgAgJwAAqw4AICgAALIOACAiAAAAJgAgAwAA6gkAIAUAAOsJACAQAADsCQAgIAAAsg4AIK4EQADeCAAhrwRAAN4IACHHBAEA2wgAIckEAQDbCAAh1AQgAKAJACHWBAAA6QmNBSLZBAEA2wgAIeYEAgDcCAAh5wQCANwIACH1BAEA2wgAIfcEAADiCfcEIvkEAADjCfkEIvoEEADdCAAh_AQAAOQJ_AQi_QQCAPYIACH_BAAA5Qn_BCKABQEA2wgAIYEFCADmCQAhggUIAOYJACGDBQAA5wkAIIQFQADmCAAhhQUBAPkIACGGBRAA-AgAIYgFAADoCYgFIokFAQD5CAAhigUBAPkIACGLBSAAoAkAIY0FAgDcCAAhjgUBANsIACEgAwAA6gkAIAUAAOsJACAQAADsCQAgrgRAAN4IACGvBEAA3ggAIccEAQDbCAAhyQQBANsIACHUBCAAoAkAIdYEAADpCY0FItkEAQDbCAAh5gQCANwIACHnBAIA3AgAIfUEAQDbCAAh9wQAAOIJ9wQi-QQAAOMJ-QQi-gQQAN0IACH8BAAA5An8BCL9BAIA9ggAIf8EAADlCf8EIoAFAQDbCAAhgQUIAOYJACGCBQgA5gkAIYMFAADnCQAghAVAAOYIACGFBQEA-QgAIYYFEAD4CAAhiAUAAOgJiAUiiQUBAPkIACGKBQEA-QgAIYsFIACgCQAhjQUCANwIACGOBQEA2wgAIR0EAACMDQAgCgAAlA0AIAwAAJMNACAOAACODQAgDwAAjQ0AIBEAAI8NACASAACQDQAgFAAAkQ0AIBoAAJUNACCQBQEAAAABxAUBAAAAAcoFQAAAAAHLBUAAAAAB7wUBAAAAAfoFAQAAAAH7BQEAAAAB_AUBAAAAAf0FAQAAAAH-BQEAAAAB_wUgAAAAAYAGIAAAAAGCBgAAAIIGAoMGAQAAAAGEBkAAAAABhQZAAAAAAYYGAQAAAAGHBgEAAAABiAZAAAAAAYkGQAAAAAECAAAAAQAgJwAAsw4AIAoGAQAAAAEHAQAAAAGuBEAAAAABrwRAAAAAAfAEAgAAAAG-BQEAAAABvwUBAAAAAcAFAQAAAAHBBQIAAAABwgUgAAAAAQeuBEAAAAABrwRAAAAAAfUEAQAAAAH3BAAAAK0FAqoFAQAAAAGrBQIAAAABrQUCAAAAAQgGAQAAAAEHAQAAAAGuBEAAAAABrwRAAAAAAfAEAgAAAAGhBQEAAAABowUAAACjBQKkBQEAAAABDwcBAAAAAa4EQAAAAAGvBEAAAAAB4AQBAAAAAeUEAQAAAAHmBAIAAAAB5wQCAAAAAegEAgAAAAHpBAIAAAAB6wQAAADrBALsBBAAAAAB7QQQAAAAAe4EQAAAAAHvBAEAAAAB8AQCAAAAAQMAAAAHACAnAACzDgAgKAAAuw4AIB8AAAAHACAEAAC0DAAgCgAAvAwAIAwAALsMACAOAAC2DAAgDwAAtQwAIBEAALcMACASAAC4DAAgFAAAuQwAIBoAAL0MACAgAAC7DgAgkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACEdBAAAtAwAIAoAALwMACAMAAC7DAAgDgAAtgwAIA8AALUMACARAAC3DAAgEgAAuAwAIBQAALkMACAaAAC9DAAgkAUBANsIACHEBQEA2wgAIcoFQADeCAAhywVAAN4IACHvBQEA-QgAIfoFAQDbCAAh-wUBANsIACH8BQEA-QgAIf0FAQD5CAAh_gUBAPkIACH_BSAAoAkAIYAGIACgCQAhggYAALMMggYigwYBAPkIACGEBkAA5ggAIYUGQADmCAAhhgYBAPkIACGHBgEA-QgAIYgGQADmCAAhiQZAAOYIACELBAYCClwGCwAaDFsFDjsIDzoKETwMEj4PFEIQFUYTGl4ZAgMIAQUKAwYECwIGDQQLAA4MNQUONAgPKQoEBRADCwAJDBQFDiAIBQYVBAcWAwgXAQobBgsABwIIAAEJAAUBChwAAwMAAQUiAw0hBAMFIwAMJAAOJQAFAwABBQADCwANEC0LETEMAQ8ACgIDAAEPAAoCEDIAETMABAQ2AAw5AA44AA83AAEDAAECCAABEwARAgNDEAsAEgEDRAAGAwABCwAYFkoUF04VGFIWGVYXARUAEwEVABMBFQATARUAEwQWVwAXWAAYWQAZWgABCAABBwRfAAplAAxkAA5hAA9gABFiABRjAAAAAAMLAB8tACAuACEAAAADCwAfLQAgLgAhAAAAAwsAJy0AKC4AKQAAAAMLACctACguACkBAwABAQMAAQULAC4tADEuADJPAC9QADAAAAAAAAULAC4tADEuADJPAC9QADAAAAMLADctADguADkAAAADCwA3LQA4LgA5AggAARMAEQIIAAETABEDCwA-LQA_LgBAAAAAAwsAPi0APy4AQAAABQsARS0ASC4ASU8ARlAARwAAAAAABQsARS0ASC4ASU8ARlAARwEG_gEEAQaEAgQFCwBOLQBRLgBSTwBPUABQAAAAAAAFCwBOLQBRLgBSTwBPUABQAwaWAgQHlwIDCJgCAQMGngIEB58CAwigAgEFCwBXLQBaLgBbTwBYUABZAAAAAAAFCwBXLQBaLgBbTwBYUABZAggAAQkABQIIAAEJAAUFCwBgLQBjLgBkTwBhUABiAAAAAAAFCwBgLQBjLgBkTwBhUABiAAAAAwsAai0Aay4AbAAAAAMLAGotAGsuAGwBCAABAQgAAQMLAHEtAHIuAHMAAAADCwBxLQByLgBzARUAEwEVABMFCwB4LQB7LgB8TwB5UAB6AAAAAAAFCwB4LQB7LgB8TwB5UAB6AgsAgwHkAYoDfwMLAIIB4wGMA37lAZADgAECCwCBAeQBkQN_AeQBkgMAAeUBkwMAAeQBlAMAAAADCwCHAS0AiAEuAIkBAAAAAwsAhwEtAIgBLgCJAQHjAbUDfgHjAbsDfgULAI4BLQCRAS4AkgFPAI8BUACQAQAAAAAABQsAjgEtAJEBLgCSAU8AjwFQAJABAAADCwCXAS0AmAEuAJkBAAAAAwsAlwEtAJgBLgCZAQAAAAMLAJ8BLQCgAS4AoQEAAAADCwCfAS0AoAEuAKEBARUAEwEVABMFCwCmAS0AqQEuAKoBTwCnAVAAqAEAAAAAAAULAKYBLQCpAS4AqgFPAKcBUACoAQAAAAULALABLQCzAS4AtAFPALEBUACyAQAAAAAABQsAsAEtALMBLgC0AU8AsQFQALIBAAAABQsAugEtAL0BLgC-AU8AuwFQALwBAAAAAAAFCwC6AS0AvQEuAL4BTwC7AVAAvAEBFQATARUAEwULAMMBLQDGAS4AxwFPAMQBUADFAQAAAAAABQsAwwEtAMYBLgDHAU8AxAFQAMUBAgPaBAEF2wQDAgPhBAEF4gQDBQsAzAEtAM8BLgDQAU8AzQFQAM4BAAAAAAAFCwDMAS0AzwEuANABTwDNAVAAzgEAAAADCwDWAS0A1wEuANgBAAAAAwsA1gEtANcBLgDYAQAAAAMLAN4BLQDfAS4A4AEAAAADCwDeAS0A3wEuAOABAgMAAQUAAwIDAAEFAAMFCwDlAS0A6AEuAOkBTwDmAVAA5wEAAAAAAAULAOUBLQDoAS4A6QFPAOYBUADnAQEPAAoBDwAKBQsA7gEtAPEBLgDyAU8A7wFQAPABAAAAAAAFCwDuAS0A8QEuAPIBTwDvAVAA8AEBFQATARUAEwULAPcBLQD6AS4A-wFPAPgBUAD5AQAAAAAABQsA9wEtAPoBLgD7AU8A-AFQAPkBAAAABQsAgQItAIQCLgCFAk8AggJQAIMCAAAAAAAFCwCBAi0AhAIuAIUCTwCCAlAAgwIAAAAFCwCLAi0AjgIuAI8CTwCMAlAAjQIAAAAAAAULAIsCLQCOAi4AjwJPAIwCUACNAgMDAAEFmwYDDZoGBAMDAAEFogYDDaEGBAULAJQCLQCXAi4AmAJPAJUCUACWAgAAAAAABQsAlAItAJcCLgCYAk8AlQJQAJYCAgMAAQ8ACgIDAAEPAAoDCwCdAi0AngIuAJ8CAAAAAwsAnQItAJ4CLgCfAgEDAAEBAwABBQsApAItAKcCLgCoAk8ApQJQAKYCAAAAAAAFCwCkAi0ApwIuAKgCTwClAlAApgIAAAAFCwCuAi0AsQIuALICTwCvAlAAsAIAAAAAAAULAK4CLQCxAi4AsgJPAK8CUACwAhsCARxmAR1oAR5pAR9qASFsASJuGyNvHCRxASVzGyZ0HSl1ASp2ASt3Gy96HjB7IjF9IzJ-IzOBASM0ggEjNYMBIzaFASM3hwEbOIgBJDmKASM6jAEbO40BJTyOASM9jwEjPpABGz-TASZAlAEqQZYBD0KXAQ9DmQEPRJoBD0WbAQ9GnQEPR58BG0igAStJogEPSqQBG0ulASxMpgEPTacBD06oARtRqwEtUqwBM1OuARFUrwERVbIBEVazARFXtAERWLYBEVm4ARtauQE0W7sBEVy9ARtdvgE1Xr8BEV_AARFgwQEbYcQBNmLFATpjxgEQZMcBEGXIARBmyQEQZ8oBEGjMARBpzgEbas8BO2vRARBs0wEbbdQBPG7VARBv1gEQcNcBG3HaAT1y2wFBc90BBHTeAQR14AEEduEBBHfiAQR45AEEeeYBG3rnAUJ76QEEfOsBG33sAUN-7QEEf-4BBIAB7wEbgQHyAUSCAfMBSoMB9AEDhAH1AQOFAfYBA4YB9wEDhwH4AQOIAfoBA4kB_AEbigH9AUuLAYACA4wBggIbjQGDAkyOAYUCA48BhgIDkAGHAhuRAYoCTZIBiwJTkwGMAgWUAY0CBZUBjgIFlgGPAgWXAZACBZgBkgIFmQGUAhuaAZUCVJsBmgIFnAGcAhudAZ0CVZ4BoQIFnwGiAgWgAaMCG6EBpgJWogGnAlyjAagCBqQBqQIGpQGqAgamAasCBqcBrAIGqAGuAgapAbACG6oBsQJdqwGzAgasAbUCG60BtgJergG3AgavAbgCBrABuQIbsQG8Al-yAb0CZbMBvwJmtAHAAma1AcMCZrYBxAJmtwHFAma4AccCZrkByQIbugHKAme7AcwCZrwBzgIbvQHPAmi-AdACZr8B0QJmwAHSAhvBAdUCacIB1gJtwwHYAhnEAdkCGcUB2wIZxgHcAhnHAd0CGcgB3wIZyQHhAhvKAeICbssB5AIZzAHmAhvNAecCb84B6AIZzwHpAhnQAeoCG9EB7QJw0gHuAnTTAe8CFNQB8AIU1QHxAhTWAfICFNcB8wIU2AH1AhTZAfcCG9oB-AJ12wH6AhTcAfwCG90B_QJ23gH-AhTfAf8CFOABgAMb4QGDA3fiAYQDfeYBhgN-5wGVA37oAZcDfukBmAN-6gGZA37rAZsDfuwBnQMb7QGeA4QB7gGgA37vAaIDG_ABowOFAfEBpAN-8gGlA37zAaYDG_QBqQOGAfUBqgOKAfYBqwN_9wGsA3_4Aa0Df_kBrgN_-gGvA3_7AbEDf_wBswMb_QG0A4sB_gG3A3__AbkDG4ACugOMAYECvAN_ggK9A3-DAr4DG4QCwQONAYUCwgOTAYYCwwOAAYcCxAOAAYgCxQOAAYkCxgOAAYoCxwOAAYsCyQOAAYwCywMbjQLMA5QBjgLOA4ABjwLQAxuQAtEDlQGRAtIDgAGSAtMDgAGTAtQDG5QC1wOWAZUC2AOaAZYC2gObAZcC2wObAZgC3gObAZkC3wObAZoC4AObAZsC4gObAZwC5AMbnQLlA5wBngLnA5sBnwLpAxugAuoDnQGhAusDmwGiAuwDmwGjAu0DG6QC8AOeAaUC8QOiAaYC8gMVpwLzAxWoAvQDFakC9QMVqgL2AxWrAvgDFawC-gMbrQL7A6MBrgL9AxWvAv8DG7ACgASkAbECgQQVsgKCBBWzAoMEG7QChgSlAbUChwSrAbYCiQSsAbcCigSsAbgCjQSsAbkCjgSsAboCjwSsAbsCkQSsAbwCkwQbvQKUBK0BvgKWBKwBvwKYBBvAApkErgHBApoErAHCApsErAHDApwEG8QCnwSvAcUCoAS1AcYCogS2AccCowS2AcgCpgS2AckCpwS2AcoCqAS2AcsCqgS2AcwCrAQbzQKtBLcBzgKvBLYBzwKxBBvQArIEuAHRArMEtgHSArQEtgHTArUEG9QCuAS5AdUCuQS_AdYCugQW1wK7BBbYArwEFtkCvQQW2gK-BBbbAsAEFtwCwgQb3QLDBMAB3gLFBBbfAscEG-ACyATBAeECyQQW4gLKBBbjAssEG-QCzgTCAeUCzwTIAeYC0AQC5wLRBALoAtIEAukC0wQC6gLUBALrAtYEAuwC2AQb7QLZBMkB7gLdBALvAt8EG_AC4ATKAfEC4wQC8gLkBALzAuUEG_QC6ATLAfUC6QTRAfYC6wTSAfcC7ATSAfgC7wTSAfkC8ATSAfoC8QTSAfsC8wTSAfwC9QQb_QL2BNMB_gL4BNIB_wL6BBuAA_sE1AGBA_wE0gGCA_0E0gGDA_4EG4QDgQXVAYUDggXZAYYDhAXaAYcDhQXaAYgDiAXaAYkDiQXaAYoDigXaAYsDjAXaAYwDjgUbjQOPBdsBjgORBdoBjwOTBRuQA5QF3AGRA5UF2gGSA5YF2gGTA5cFG5QDmgXdAZUDmwXhAZYDnAUKlwOdBQqYA54FCpkDnwUKmgOgBQqbA6IFCpwDpAUbnQOlBeIBngOnBQqfA6kFG6ADqgXjAaEDqwUKogOsBQqjA60FG6QDsAXkAaUDsQXqAaYDsgULpwOzBQuoA7QFC6kDtQULqgO2BQurA7gFC6wDugUbrQO7BesBrgO9BQuvA78FG7ADwAXsAbEDwQULsgPCBQuzA8MFG7QDxgXtAbUDxwXzAbYDyAUXtwPJBRe4A8oFF7kDywUXugPMBRe7A84FF7wD0AUbvQPRBfQBvgPTBRe_A9UFG8AD1gX1AcED1wUXwgPYBRfDA9kFG8QD3AX2AcUD3QX8AcYD3wX9AccD4AX9AcgD4wX9AckD5AX9AcoD5QX9AcsD5wX9AcwD6QUbzQPqBf4BzgPsBf0BzwPuBRvQA-8F_wHRA_AF_QHSA_EF_QHTA_IFG9QD9QWAAtUD9gWGAtYD-AWHAtcD-QWHAtgD_AWHAtkD_QWHAtoD_gWHAtsDgAaHAtwDggYb3QODBogC3gOFBocC3wOHBhvgA4gGiQLhA4kGhwLiA4oGhwLjA4sGG-QDjgaKAuUDjwaQAuYDkAYI5wORBgjoA5IGCOkDkwYI6gOUBgjrA5YGCOwDmAYb7QOZBpEC7gOdBgjvA58GG_ADoAaSAvEDowYI8gOkBgjzA6UGG_QDqAaTAvUDqQaZAvYDqgYM9wOrBgz4A6wGDPkDrQYM-gOuBgz7A7AGDPwDsgYb_QOzBpoC_gO1Bgz_A7cGG4AEuAabAoEEuQYMggS6BgyDBLsGG4QEvgacAoUEvwagAoYEwQYThwTCBhOIBMQGE4kExQYTigTGBhOLBMgGE4wEygYbjQTLBqECjgTNBhOPBM8GG5AE0AaiApEE0QYTkgTSBhOTBNMGG5QE1gajApUE1wapApYE2QaqApcE2gaqApgE3QaqApkE3gaqApoE3waqApsE4QaqApwE4wYbnQTkBqsCngTmBqoCnwToBhugBOkGrAKhBOoGqgKiBOsGqgKjBOwGG6QE7watAqUE8AazAg"
};
async function decodeBase64AsWasm(wasmBase64) {
	const { Buffer } = await import("node:buffer");
	const wasmArray = Buffer.from(wasmBase64, "base64");
	return new WebAssembly.Module(wasmArray);
}
config$1.compilerWasm = {
	getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
	getQueryCompilerWasmModule: async () => {
		const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
		return await decodeBase64AsWasm(wasm);
	},
	importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
	return runtime.getPrismaClient(config$1);
}

//#endregion
//#region src/generated/prisma/internal/prismaNamespace.ts
const getExtensionContext = runtime.Extensions.getExtensionContext;
const NullTypes = {
	DbNull: runtime.NullTypes.DbNull,
	JsonNull: runtime.NullTypes.JsonNull,
	AnyNull: runtime.NullTypes.AnyNull
};
/**
* Enums
*/
const TransactionIsolationLevel = runtime.makeStrictEnum({
	ReadUncommitted: "ReadUncommitted",
	ReadCommitted: "ReadCommitted",
	RepeatableRead: "RepeatableRead",
	Serializable: "Serializable"
});
const defineExtension = runtime.Extensions.defineExtension;

//#endregion
//#region src/generated/prisma/client.ts
globalThis["__dirname"] = path.dirname(fileURLToPath$1(import.meta.url));
/**
* ## Prisma Client
* 
* Type-safe database client for TypeScript
* @example
* ```
* const prisma = new PrismaClient({
*   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
* })
* // Fetch zero or more Users
* const users = await prisma.user.findMany()
* ```
* 
* Read more in our [docs](https://pris.ly/d/client).
*/
const PrismaClient = getPrismaClientClass();

//#endregion
//#region src/config/database.ts
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../.env");
dotenv.config({
	path: envPath,
	override: false
});
console.log(`Loaded backend environment from: ${envPath}`);
const connectionString = `${process.env.DATABASE_URL}`;
const extractHostPort = (conn) => {
	try {
		if (!conn) return null;
		const m = conn.match(/@([^:/?#]+)(?::(\d+))?/);
		if (!m) return null;
		return {
			host: m[1],
			port: m[2] ?? "5432"
		};
	} catch {
		return null;
	}
};
const connInfo = extractHostPort(connectionString);
if (connInfo) console.log(`Prisma DB host: ${connInfo.host}, port: ${connInfo.port}`);
else console.log("Prisma DB connection string not detected or could not be parsed");
if (!connectionString) {
	console.error("DATABASE_URL is not set. Please configure devbackend-main/.env correctly.");
	throw new Error("Missing DATABASE_URL");
}
if (!connectionString) {
	console.error("DATABASE_URL is not set. Please configure devbackend-main/.env correctly.");
	throw new Error("Missing DATABASE_URL");
}
const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString }),
	log: process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error"] : ["error"]
});

//#endregion
//#region src/repositories/users.repository.ts
const logContext$14 = {
	service: "UserRepository",
	function: ""
};
const createUser$1 = async (user, tx = prisma) => {
	return await tx.user.create({ data: user }).catch((err) => {
		logContext$14.function = "createUser";
		logger.error(logContext$14, "Error in createUser repository", { error: err });
		throw new Error("DB: user create operation failed");
	});
};
const findUserByEmail$1 = async (email, select) => {
	return await prisma.user.findUnique({
		where: { email },
		select
	}).catch((err) => {
		console.error("Prisma raw error in findUserByEmail:", err);
		logContext$14.function = "findUserByEmail";
		logger.error(logContext$14, "Error in findUserByEmail repository", { error: err });
		const errorMessage = err instanceof Error ? err.message : "unknown error";
		throw new Error(`DB: findUserByEmail operation failed: ${errorMessage}`);
	});
};
const findUserByVerifyCodeHash = async (email, hashedCode) => {
	return await prisma.user.findFirst({
		where: {
			verifyCodeHash: hashedCode,
			email
		},
		select: {
			userId: true,
			email: true,
			isEmailVerified: true,
			verifyCodeHash: true,
			verifyCodeExpiry: true
		}
	}).catch((err) => {
		logContext$14.function = "findUserByVerifyCodeHash";
		logger.error(logContext$14, "Error in findUserByVerifyCodeHash repository", { error: err });
		throw new Error("DB: findUserByVerifyCodeHash operation failed");
	});
};
const updateUserVerifyCode = async (email, verifyCodeHash, verifyCodeExpiry) => {
	return await prisma.user.update({
		where: { email },
		data: {
			verifyCodeHash,
			verifyCodeExpiry
		},
		select: {
			userId: true,
			email: true,
			isEmailVerified: true
		}
	}).catch((err) => {
		logContext$14.function = "updateUserVerifyCode";
		logger.error(logContext$14, "Error in updateUserVerifyCode repository", { error: err });
		throw new Error("DB: updateUserVerifyCode operation failed");
	});
};
const verifyUserEmail = async (email) => {
	return await prisma.user.update({
		where: { email },
		data: {
			isEmailVerified: true,
			verifiedAt: /* @__PURE__ */ new Date(),
			verifyCodeHash: null,
			verifyCodeExpiry: null
		},
		select: {
			userId: true,
			email: true,
			firstName: true,
			lastName: true,
			isEmailVerified: true,
			verifiedAt: true,
			role: true
		}
	}).catch((err) => {
		logContext$14.function = "verifyUserEmail";
		logger.error(logContext$14, "Error in verifyUserEmail repository", { error: err });
		throw new Error("DB: verifyUserEmail operation failed");
	});
};
const findAllUsers$1 = async (limit, offset) => {
	return await prisma.user.findMany({
		take: limit,
		skip: offset,
		select: {
			userId: true,
			email: true,
			firstName: true,
			lastName: true,
			isEmailVerified: true,
			isActive: true,
			role: true,
			createdAt: true
		}
	}).catch((err) => {
		logContext$14.function = "findAllUsers";
		logger.error(logContext$14, "Error in findAllUsers repository", { error: err });
		throw new Error("DB: findAllUsers operation failed");
	});
};
const findUserById = async (userId, select) => {
	return await prisma.user.findUnique({
		where: { userId },
		select
	}).catch((err) => {
		logContext$14.function = "findUserById";
		logger.error(logContext$14, "Error in findUserById repository", { error: err });
		throw new Error("DB: findUserById operation failed");
	});
};
const updateUserPassword$1 = async (userId, passwordHash) => {
	return await prisma.user.update({
		where: { userId },
		data: { passwordHash }
	}).catch((err) => {
		logContext$14.function = "updateUserPassword";
		logger.error(logContext$14, "Error in updateUserPassword repository", { error: err });
		throw new Error("DB: updateUserPassword operation failed");
	});
};
const updateUserPasswordAndClearCode$1 = async (userId, passwordHash) => {
	return await prisma.user.update({
		where: { userId },
		data: {
			passwordHash,
			verifyCodeHash: null,
			verifyCodeExpiry: null
		}
	}).catch((err) => {
		logContext$14.function = "updateUserPasswordAndClearCode";
		logger.error(logContext$14, "Error in updateUserPasswordAndClearCode repository", { error: err });
		throw new Error("DB: updateUserPasswordAndClearCode operation failed");
	});
};
const findUserByGoogleId = async (googleId) => {
	return await prisma.user.findUnique({
		where: { googleId },
		select: {
			userId: true,
			email: true,
			firstName: true,
			lastName: true,
			role: true,
			isEmailVerified: true,
			isActive: true,
			googleId: true,
			facebookId: true
		}
	}).catch((err) => {
		logContext$14.function = "findUserByGoogleId";
		logger.error(logContext$14, "Error in findUserByGoogleId repository", { error: err });
		throw new Error("DB: findUserByGoogleId operation failed");
	});
};
const findUserByFacebookId = async (facebookId) => {
	return await prisma.user.findUnique({
		where: { facebookId },
		select: {
			userId: true,
			email: true,
			firstName: true,
			lastName: true,
			role: true,
			isEmailVerified: true,
			isActive: true,
			googleId: true,
			facebookId: true
		}
	}).catch((err) => {
		logContext$14.function = "findUserByFacebookId";
		logger.error(logContext$14, "Error in findUserByFacebookId repository", { error: err });
		throw new Error("DB: findUserByFacebookId operation failed");
	});
};
/**
* Creates a new SSO user or, if the email already exists, links the SSO identity
* onto the existing account (auto-link strategy).
*/
const upsertSsoUser = async (data) => {
	const { email, firstName, lastName, googleId, facebookId } = data;
	return await prisma.user.upsert({
		where: { email },
		create: {
			email,
			firstName,
			lastName,
			isEmailVerified: true,
			isActive: true,
			googleId: googleId ?? null,
			facebookId: facebookId ?? null
		},
		update: {
			...googleId ? { googleId } : {},
			...facebookId ? { facebookId } : {}
		},
		select: {
			userId: true,
			email: true,
			firstName: true,
			lastName: true,
			role: true,
			isEmailVerified: true,
			isActive: true,
			googleId: true,
			facebookId: true
		}
	}).catch((err) => {
		logContext$14.function = "upsertSsoUser";
		logger.error(logContext$14, "Error in upsertSsoUser repository", { error: err });
		throw new Error("DB: upsertSsoUser operation failed");
	});
};

//#endregion
//#region src/config/index.ts
dotenv.config();
const nodeEnv = process.env.NODE_ENV ?? "development";
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshTokenSecret = process.env.JWT_REFRESH_SECRET;
if (nodeEnv === "production" && (!jwtSecret || !jwtRefreshTokenSecret)) throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be configured in production.");
const config = {
	port: process.env.PORT ?? 5e3,
	nodeEnv,
	databaseUrl: process.env.DATABASE_URL ?? "",
	jwtSecret: jwtSecret ?? "development-only-access-secret",
	jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
	jwtRefreshTokenSecret: jwtRefreshTokenSecret ?? "development-only-refresh-secret",
	jwtRefreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
	jwtIssuer: process.env.JWT_ISSUER ?? "roomreview-api",
	jwtAccessTokenAudience: process.env.JWT_ACCESS_TOKEN_AUDIENCE ?? "roomreview-client",
	jwtRefreshTokenAudience: process.env.JWT_REFRESH_TOKEN_AUDIENCE ?? "roomreview-auth",
	corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
	saltKeyLength: 16,
	passwordHashLength: 64,
	sendGridApiKey: process.env.SENDGRID_API_KEY ?? "",
	emailFrom: process.env.EMAIL_FROM ?? "",
	sendGridSandboxMode: process.env.SENDGRID_SANDBOX_MODE === "false" ? false : true,
	sendGridDataResidence: "eu",
	sendVerifyEmailCodeV1TemplateId: "d-2495bae5bdb84fa1b2afc8c4dacb0e59",
	sendResetPasswordCodeV1TemplateId: "d-56e1f0eb30c34b7fb20ca9e21bab30a1",
	sendGridTemplateParameters: {
		"d-2495bae5bdb84fa1b2afc8c4dacb0e59": {
			name: "Customer",
			code: "######",
			contact_button_link: process.env.ROOMREVIEW_CONTACT_LINK ?? "/"
		},
		"d-56e1f0eb30c34b7fb20ca9e21bab30a1": {
			contact_button_link: process.env.ROOMREVIEW_CONTACT_LINK ?? "/",
			reset_pswd_button_link: process.env.ROOMREVIEW_RESET_PASSWORD_LINK ?? "/"
		}
	},
	enableGoogleSSO: process.env.ENABLE_GOOGLE_SSO === "true" ? true : false,
	enableFacebookSSO: process.env.ENABLE_FACEBOOK_SSO === "true" ? true : false,
	googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
	googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
	googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:5000/api/v1/sso/google/callback",
	facebookAppId: process.env.FACEBOOK_APP_ID ?? "",
	facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? "",
	facebookCallbackUrl: process.env.FACEBOOK_CALLBACK_URL ?? "http://localhost:5000/api/v1/sso/facebook/callback",
	frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
	spaces: {
		bucket: process.env.DO_SPACES_BUCKET ?? "",
		region: process.env.DO_SPACES_REGION ?? "lon1",
		endpoint: process.env.DO_SPACES_ENDPOINT ?? "https://lon1.digitaloceanspaces.com",
		mapPrefix: process.env.DO_SPACES_MAP_PREFIX ?? "lsoa_maps",
		accessKeyId: process.env.DO_SPACES_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.DO_SPACES_SECRET_ACCESS_KEY ?? "",
		signedUrlTtlSeconds: Number(process.env.DO_SPACES_SIGNED_URL_TTL_SECONDS ?? 900)
	},
	stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
	stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
	stripeReportPriceId: process.env.STRIPE_REPORT_PRICE_ID ?? "",
	stripeSubscriptionPriceId: process.env.STRIPE_SUBSCRIPTION_PRICE_ID ?? "",
	stripeSubscriptionCredits: Number(process.env.STRIPE_SUBSCRIPTION_CREDITS ?? 10),
	stripeSubscriptionAmount: Number(process.env.STRIPE_SUBSCRIPTION_AMOUNT ?? 3500),
	stripeReportAmount: Number(process.env.STRIPE_REPORT_AMOUNT ?? 1999),
	stripeCurrency: process.env.STRIPE_CURRENCY ?? "gbp",
	stripeSuccessUrl: process.env.STRIPE_SUCCESS_URL ?? `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
	stripeCancelUrl: process.env.STRIPE_CANCEL_URL ?? `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/checkout/cancel`
};

//#endregion
//#region src/utils/password.ts
const validateSalt = (salt) => {
	return typeof salt === "string" && salt.length === config.saltKeyLength * 2;
};
const generateSalt = (length = config.saltKeyLength) => {
	return randomBytes(length).toString("hex");
};
/**
* Generates a salt and hashes the password.
* Returns a string in the format "salt:hash" for easy database storage.
*/
const hashPassword = async (password, salt) => {
	if (!salt || !validateSalt(salt)) salt = generateSalt();
	const hash = await scryptSync(password, salt, config.passwordHashLength);
	return `${salt}:${hash.toString("hex")}`;
};
/**
* Compares a plain-text password against a stored "salt:hash" string.
*/
const comparePassword = async (password, storedHash) => {
	const [salt, hash] = storedHash.split(":");
	if (!validateSalt(salt)) return false;
	return (await scryptSync(password, salt, config.passwordHashLength)).toString("hex") === hash;
};

//#endregion
//#region src/utils/helpers.ts
const paginate = (page, limit) => {
	return {
		offset: (page - 1) * limit,
		limit
	};
};
const buildPaginatedResult = (data, total, page, limit) => {
	return {
		data,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		}
	};
};

//#endregion
//#region src/repositories/agencies.repository.ts
const logContext$13 = {
	service: "AgencyRepository",
	function: ""
};
const createAgency$1 = async (data, tx = prisma) => {
	return await tx.agency.create({ data }).catch((err) => {
		logContext$13.function = "createAgency";
		logger.error(logContext$13, "Error in createAgency repository", { error: err });
		throw new Error("DB: agency create operation failed");
	});
};
const createUserAgency = async (data, tx = prisma) => {
	return await tx.userAgency.create({ data }).catch((err) => {
		logContext$13.function = "createUserAgency";
		logger.error(logContext$13, "Error in createUserAgency repository", { error: err });
		throw new Error("DB: userAgency create operation failed");
	});
};

//#endregion
//#region src/services/user.service.ts
const defaultSelectFields = {
	userId: true,
	firstName: true,
	lastName: true,
	isEmailVerified: true,
	isActive: true,
	email: true,
	role: true
};
const findAllUsers = async (data) => {
	const { page, limit } = data;
	const { offset } = paginate(page, limit);
	return { users: await findAllUsers$1(limit, offset) };
};
const getCurrentUserProfile = async (id) => findUserById(id, defaultSelectFields);
const getUserSensitiveById = async (id) => {
	const selectFields = {
		...defaultSelectFields,
		passwordHash: true
	};
	return await findUserById(id, selectFields);
};
const updateUserPassword = async (id, passwordHash) => {
	return await updateUserPassword$1(id, passwordHash);
};
const updateUserPasswordAndClearCode = async (id, passwordHash) => {
	return await updateUserPasswordAndClearCode$1(id, passwordHash);
};
const changePassword$1 = async (id, data) => {
	const user = await getUserSensitiveById(id);
	if (!user) throw new EntityNotFoundError({
		message: "User not found",
		code: "ENTITY_NOT_FOUND"
	});
	if (!await comparePassword(data.oldPassword, user.passwordHash ?? "")) throw new UnauthorizedError({
		message: "Invalid old password",
		code: "VALIDATION_ERROR"
	});
	await updateUserPassword(id, await hashPassword(data.newPassword));
	return { success: true };
};
const findUserByEmail = async (email, selectFields) => {
	return await findUserByEmail$1(email, selectFields || defaultSelectFields);
};
const getUserSensitiveByEmail = async (email) => {
	const selectFields = {
		...defaultSelectFields,
		passwordHash: true
	};
	return await findUserByEmail$1(email, selectFields);
};
const registerUser$1 = async (data, hashedPassword, token) => {
	return await prisma.$transaction(async (tx) => {
		const newUser = await createUser$1({
			email: data.email,
			firstName: data.firstName,
			lastName: data.lastName,
			verifyCodeExpiry: token.expiresAt,
			verifyCodeHash: token.hashedCode,
			passwordHash: hashedPassword,
			isEmailVerified: false,
			isActive: true,
			role: data.role
		}, tx);
		if (data.role === UserRole.AGENCY || data.role === UserRole.AGENT) {
			const trialStartedAt = /* @__PURE__ */ new Date();
			const trialEndsAt = new Date(trialStartedAt.getTime() + 720 * 60 * 60 * 1e3);
			await tx.$executeRaw`
        UPDATE users
        SET trial_started_at = ${trialStartedAt}, trial_ends_at = ${trialEndsAt}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${newUser.userId}::uuid
      `;
		}
		if (data.role === UserRole.AGENCY || data.role === UserRole.AGENT) {
			const agency = await createAgency$1({
				name: data.agencyName,
				description: data.agencyDescription,
				email: data.agencyEmail,
				phone: data.agencyPhone,
				website: data.agencyWebsite
			}, tx);
			await createUserAgency({
				userId: newUser.userId,
				agencyId: agency.agencyId,
				isVerified: false
			}, tx);
		}
		return newUser;
	});
};
const registerEarlyAccessUser$1 = async (userId, data, passwordHash, verification) => {
	return prisma.$transaction(async (tx) => {
		const trialStartedAt = /* @__PURE__ */ new Date();
		const trialEndsAt = new Date(trialStartedAt.getTime() + 720 * 60 * 60 * 1e3);
		const user = await tx.user.create({ data: {
			userId,
			email: data.email,
			firstName: data.firstName,
			lastName: data.lastName,
			passwordHash,
			isEmailVerified: false,
			isActive: true,
			role: UserRole.TENANT,
			verifyCodeHash: verification.hashedCode,
			verifyCodeExpiry: verification.expiresAt,
			trialStartedAt,
			trialEndsAt
		} });
		const userCreditsId = randomUUID();
		await tx.$executeRaw`
      INSERT INTO billing_credit_grants
        (billing_credit_grant_id, user_id, stripe_event_id, stripe_invoice_id, credits)
      VALUES (${randomUUID()}::uuid, ${user.userId}::uuid, ${`early-access-trial:${user.userId}`}, NULL, 3)
    `;
		await tx.$executeRaw`
      INSERT INTO user_credits
        (user_credits_id, user_id, credits_balance, subscription_plan, created_at, updated_at)
      VALUES (${userCreditsId}::uuid, ${user.userId}::uuid, 3, 'FREE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
		await tx.$executeRaw`
      INSERT INTO credit_transactions
        (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${userCreditsId}::uuid, 3, 'BONUS', 'Early access: three free branded reports', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
		return {
			user,
			trialEndsAt
		};
	});
};

//#endregion
//#region src/utils/token.ts
const expirationMinutes = 15;
const hashCode = (code) => {
	return crypto$1.createHash("sha256").update(code).digest("hex");
};
const generateVerificationCode = () => {
	const code = crypto$1.randomInt(1e5, 999999).toString();
	return {
		code,
		expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1e3),
		hashedCode: hashCode(code)
	};
};
const verifyCode = (providedCode, hashedCode) => {
	return hashCode(providedCode) === hashedCode;
};
const isCodeExpired = (expiresAt) => {
	return /* @__PURE__ */ new Date() > expiresAt;
};

//#endregion
//#region src/repositories/sessions.repository.ts
const logContext$12 = {
	service: "SessionRepository",
	function: ""
};
const logoutSessionByUserId = async (userId) => {
	return await prisma.session.update({
		where: { userId },
		data: {
			accessTokenId: null,
			accessTokenExpiry: null,
			refreshTokenId: null,
			refreshTokenExpiry: null
		}
	}).catch((err) => {
		logContext$12.function = "logoutSessionByUserId";
		logger.error(logContext$12, "Error in logoutSessionByUserId repository", { error: err });
		throw new Error("DB: logoutSessionByUserId operation failed");
	});
};
const upsertSession = async (data) => {
	const { userId, accessTokenId, accessTokenExpiry, refreshTokenId, refreshTokenExpiry } = data;
	return await prisma.session.upsert({
		where: { userId },
		update: {
			accessTokenId,
			accessTokenExpiry,
			refreshTokenId,
			refreshTokenExpiry
		},
		create: {
			userId,
			accessTokenId,
			accessTokenExpiry,
			refreshTokenId,
			refreshTokenExpiry
		},
		select: {
			sessionId: true,
			userId: true
		}
	}).catch((err) => {
		logContext$12.function = "upsertSession";
		logger.error(logContext$12, "Error in upsertSession repository", { error: err });
		throw new Error("DB: upsertSession operation failed");
	});
};
/**
* find user session by userId & access token id
*/
const findUserSessionByAccessTokenId = async (accessTokenId, userId) => {
	return await prisma.session.findFirst({ where: {
		accessTokenId,
		userId
	} }).catch((err) => {
		logContext$12.function = "findUserSessionByAccessTokenId";
		logger.error(logContext$12, "Error in findUserSessionByAccessTokenId repository", { error: err });
		throw new Error("DB: findUserSessionByAccessTokenId operation failed");
	});
};
/**
* find user session by userId & refresh token id
*/
const findUserSessionByRefreshTokenId = async (refreshTokenId, userId) => {
	return await prisma.session.findFirst({ where: {
		refreshTokenId,
		userId
	} }).catch((err) => {
		logContext$12.function = "findUserSessionByRefreshTokenId";
		logger.error(logContext$12, "Error in findUserSessionByRefreshTokenId repository", { error: err });
		throw new Error("DB: findUserSessionByRefreshTokenId operation failed");
	});
};

//#endregion
//#region src/utils/jwt.token.ts
const logContext$11 = {
	service: "JwtTokenService",
	function: ""
};
/**
* Low-level sign wrapper. Accepts an explicit `SignOptions` so callers can
* inject `jwtid`, `issuer`, `audience`, and `expiresIn` in one shot.
*
* Prefer the typed helpers (`generateAccessToken` / `generateRefreshToken`).
* - HS256:    HMAC using SHA-256 hash algorithm (default)
*/
const generateToken = (payload, secret, options) => {
	logContext$11.function = "generateToken";
	logger.info(logContext$11, "Generating JWT token", { sub: payload.sub });
	const token = jwt.sign(payload, secret, options);
	const decoded = jwt.decode(token);
	const expiresAt = decoded?.exp ? /* @__PURE__ */ new Date(decoded.exp * 1e3) : void 0;
	return {
		token,
		jti: options.jwtid,
		expiresAt,
		expiresIn: options.expiresIn
	};
};
/**
* Low-level verify wrapper. Pass `VerifyOptions` with `issuer` / `audience`
* to let `jsonwebtoken` validate those claims automatically.
*
* Throws `UnauthorizedError` (401) for missing / invalid / expired tokens,
* or `InternalServerError` (500) for unexpected failures.
*/
const verifyToken = (token, secret, options = {}) => {
	logContext$11.function = "verifyToken";
	if (!token) throw new UnauthorizedError({
		message: "Token is required",
		code: ErrorCodes.VALIDATION_ERROR
	});
	try {
		const decoded = jwt.verify(token, secret, options);
		logger.info(logContext$11, "JWT token verified", {
			sub: decoded.sub,
			jti: decoded.jti
		});
		return decoded;
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			logger.warn(logContext$11, "JWT token expired", { error: error.message });
			throw new UnauthorizedError({
				message: "Token has expired",
				code: ErrorCodes.VALIDATION_ERROR,
				data: { reason: "TOKEN_EXPIRED" }
			});
		}
		if (error instanceof jwt.JsonWebTokenError) {
			logger.warn(logContext$11, "JWT token invalid", { error: error.message });
			throw new UnauthorizedError({
				message: "Invalid token",
				code: ErrorCodes.VALIDATION_ERROR,
				data: { reason: "TOKEN_INVALID" }
			});
		}
		logger.error(logContext$11, "Unexpected error during JWT verification", { error });
		throw new InternalServerError({
			message: "Token verification failed",
			code: ErrorCodes.INTERNAL_SERVER_ERROR
		});
	}
};
/**
* Signs a short-lived access token.
*
* Injected claims:
*   - `jti`  unique UUID v4 per token
*   - `iss`  `config.jwtIssuer`                   (e.g. "roomreview-api")
*   - `aud`  `config.jwtAccessTokenAudience`       (e.g. "roomreview-client")
*   - `exp`  `config.jwtExpiresIn`                 (default 15 m)
*/
const generateAccessToken = (payload) => {
	logContext$11.function = "generateAccessToken";
	logger.info(logContext$11, "Generating access token", { sub: payload.sub });
	return generateToken(payload, config.jwtSecret, {
		expiresIn: config.jwtExpiresIn,
		jwtid: crypto$1.randomUUID(),
		issuer: config.jwtIssuer,
		audience: config.jwtAccessTokenAudience
	});
};
/**
* Verifies an access token, including `iss` and `aud` claim validation.
* Throws `UnauthorizedError` (401) for any failure.
*/
const verifyAccessToken = (token) => {
	logContext$11.function = "verifyAccessToken";
	logger.info(logContext$11, "Verifying access token");
	return verifyToken(token, config.jwtSecret, {
		issuer: config.jwtIssuer,
		audience: config.jwtAccessTokenAudience
	});
};
/**
* Signs a long-lived refresh token.
*
* Injected claims:
*   - `jti`  unique UUID v4 per token
*   - `iss`  `config.jwtIssuer`                   (e.g. "roomreview-api")
*   - `aud`  `config.jwtRefreshTokenAudience`      (e.g. "roomreview-auth")
*   - `exp`  `config.jwtRefreshTokenExpiresIn`     (default 30 d)
*/
const generateRefreshToken = (payload) => {
	logContext$11.function = "generateRefreshToken";
	logger.info(logContext$11, "Generating refresh token", { sub: payload.sub });
	return generateToken(payload, config.jwtRefreshTokenSecret, {
		expiresIn: config.jwtRefreshTokenExpiresIn,
		jwtid: crypto$1.randomUUID(),
		issuer: config.jwtIssuer,
		audience: config.jwtRefreshTokenAudience
	});
};
/**
* Verifies a refresh token, including `iss` and `aud` claim validation.
* Throws `UnauthorizedError` (401) for any failure.
*/
const verifyRefreshToken = (token) => {
	logContext$11.function = "verifyRefreshToken";
	logger.info(logContext$11, "Verifying refresh token");
	return verifyToken(token, config.jwtRefreshTokenSecret, {
		issuer: config.jwtIssuer,
		audience: config.jwtRefreshTokenAudience
	});
};

//#endregion
//#region src/utils/email.ts
const logContext$10 = {
	service: "email.service",
	function: ""
};
const sendEmail = async (data) => {
	logContext$10.function = "sendEmail";
	if (!config.sendGridApiKey) {
		const message = "SendGrid API key is not defined";
		logger.error(logContext$10, message, {});
		throw new Error(message);
	}
	if (!config.emailFrom) {
		const message = "Email sender address is not configured";
		logger.error(logContext$10, message, {});
		throw new Error(message);
	}
	sgMail.setApiKey(config.sendGridApiKey);
	logger.info(logContext$10, "Sending email", {
		to: data.personalizations?.[0]?.to,
		templateId: data.templateId
	});
	try {
		await sgMail.send(data);
		logger.info(logContext$10, "Email sent successfully", {
			to: data.personalizations?.[0]?.to,
			templateId: data.templateId
		});
	} catch (error) {
		const message = "Failed to send email";
		logger.error(logContext$10, message, { error });
		throw new Error(message);
	}
};
const sendVerificationEmail = async (toEmail, code, name) => {
	let templateData = { ...config.sendGridTemplateParameters[config.sendVerifyEmailCodeV1TemplateId] };
	if (!toEmail) throw new Error("toEmail is not defined");
	if (!code) throw new Error("code is not defined");
	if (!name) throw new Error("name is not defined");
	templateData.code = code;
	templateData.name = name;
	await sendEmail({
		from: {
			email: config.emailFrom,
			name: "RoomReview"
		},
		templateId: config.sendVerifyEmailCodeV1TemplateId,
		categories: ["verification"],
		personalizations: [{
			to: {
				email: toEmail,
				name
			},
			dynamicTemplateData: templateData
		}],
		mailSettings: { sandboxMode: { enable: config.sendGridSandboxMode } }
	});
};
const sendResetPasswordEmail = async (toEmail, name, resetPasswordLink) => {
	let templateData = { ...config.sendGridTemplateParameters[config.sendResetPasswordCodeV1TemplateId] };
	if (!toEmail) throw new Error("toEmail is not defined");
	if (!name) throw new Error("name is not defined");
	if (resetPasswordLink) templateData.reset_pswd_button_link = resetPasswordLink;
	templateData.name = name;
	await sendEmail({
		from: {
			email: config.emailFrom,
			name: "RoomReview"
		},
		templateId: config.sendResetPasswordCodeV1TemplateId,
		categories: ["reset-password"],
		personalizations: [{
			to: {
				email: toEmail,
				name
			},
			dynamicTemplateData: templateData
		}],
		mailSettings: { sandboxMode: { enable: config.sendGridSandboxMode } }
	});
};

//#endregion
//#region src/utils/disposable-email.ts
const domains = createRequire(import.meta.url)("disposable-email-domains");
if (!Array.isArray(domains)) throw new Error("Unable to load disposable email domain list");
const disposableDomains = new Set(domains.filter((domain) => typeof domain === "string").map((domain) => domain.toLowerCase()));
const isDisposableEmail = (emailAddress) => {
	const labels = emailAddress.slice(emailAddress.lastIndexOf("@") + 1).toLowerCase().split(".");
	return labels.some((_, index) => disposableDomains.has(labels.slice(index).join(".")));
};

//#endregion
//#region src/services/auth.service.ts
const logContext$9 = {
	service: "auth.service",
	function: ""
};
const registerUser = async (data) => {
	logContext$9.function = "registerUser";
	if (await findUserByEmail(data.email)) throw new ValidationError({
		message: "This email address is already taken",
		code: "VALIDATION_ERROR"
	});
	const hashedPassword = await hashPassword(data.password);
	const token = generateVerificationCode();
	logger.info(logContext$9, "Verification token generated", { token });
	let emailSent = false;
	try {
		await sendVerificationEmail(data.email, token.code, `${data.firstName} ${data.lastName}`);
		emailSent = true;
	} catch (error) {
		logger.warn(logContext$9, "Verification email could not be sent; continuing registration", {
			email: data.email,
			error
		});
	}
	const { passwordHash, verifyCodeHash, ...userWithoutSensitive } = await registerUser$1(data, hashedPassword, {
		expiresAt: token.expiresAt,
		hashedCode: token.hashedCode
	});
	return {
		user: userWithoutSensitive,
		session: {},
		isExistingUser: false,
		emailSent,
		verificationCode: emailSent ? void 0 : token.code
	};
};
const registerEarlyAccessUser = async (data) => {
	logContext$9.function = "registerEarlyAccessUser";
	const normalizedData = {
		...data,
		firstName: data.firstName.trim(),
		lastName: data.lastName.trim(),
		email: data.email.trim().toLowerCase()
	};
	if (isDisposableEmail(normalizedData.email)) throw new ValidationError({
		message: "Please use a non-disposable email address",
		code: "VALIDATION_ERROR"
	});
	if (await findUserByEmail(normalizedData.email)) throw new ValidationError({
		message: "This email address is already taken",
		code: "VALIDATION_ERROR"
	});
	const passwordHash = await hashPassword(normalizedData.password);
	const verification = generateVerificationCode();
	const userId = randomUUID();
	let account;
	try {
		account = await registerEarlyAccessUser$1(userId, {
			email: normalizedData.email,
			firstName: normalizedData.firstName,
			lastName: normalizedData.lastName
		}, passwordHash, verification);
	} catch (error) {
		if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new ValidationError({
			message: "This email address is already taken",
			code: "VALIDATION_ERROR"
		});
		throw error;
	}
	const { user, trialEndsAt } = account;
	let emailSent = false;
	try {
		await sendVerificationEmail(user.email, verification.code, `${user.firstName} ${user.lastName}`);
		emailSent = true;
	} catch (error) {
		logger.warn(logContext$9, "Early access verification email could not be sent", {
			email: user.email,
			error
		});
	}
	return {
		user: {
			userId: user.userId,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			isActive: user.isActive,
			isEmailVerified: user.isEmailVerified,
			trialStartedAt: user.trialStartedAt,
			trialEndsAt: user.trialEndsAt
		},
		trialEndsAt,
		emailSent
	};
};
const loginUser = async (email, password) => {
	const user = await getUserSensitiveByEmail(email);
	if (!user) return {
		user: null,
		session: null
	};
	const { passwordHash, ...userWithoutPassword } = user;
	if (!user.isActive || !user.isEmailVerified) return {
		user: userWithoutPassword,
		session: null
	};
	if (!await comparePassword(password, user?.passwordHash ?? "")) throw new UnauthorizedError({
		message: "Invalid credentials",
		code: "VALIDATION_ERROR"
	});
	const accessTokenObj = generateAccessToken({
		email: user.email,
		sub: user.userId,
		role: user.role
	});
	const refreshTokenObj = generateRefreshToken({
		email: user.email,
		sub: user.userId,
		role: user.role
	});
	return {
		user: userWithoutPassword,
		session: {
			...await upsertSession({
				userId: user.userId,
				accessTokenId: accessTokenObj?.jti ?? null,
				refreshTokenId: refreshTokenObj?.jti ?? null,
				accessTokenExpiry: accessTokenObj.expiresAt ?? null,
				refreshTokenExpiry: refreshTokenObj.expiresAt ?? null
			}),
			accessToken: accessTokenObj.token,
			refreshToken: refreshTokenObj.token
		}
	};
};
const logoutUser = async (userId) => {
	return await logoutSessionByUserId(userId);
};
const resetEmailVerification = async (email) => {
	logContext$9.function = "resetEmailVerification";
	const user = await findUserByEmail(email);
	if (!user) throw new EntityNotFoundError({
		message: "User not found",
		code: "ENTITY_NOT_FOUND"
	});
	if (user.isEmailVerified) throw new ValidationError({
		message: "Email is already verified",
		code: "VALIDATION_ERROR"
	});
	const token = generateVerificationCode();
	await updateUserVerifyCode(email, token.hashedCode, token.expiresAt);
	logger.info(logContext$9, "Verification code reset — dev-only log", {
		email,
		code: token.code
	});
	return { isNewCodeGenerated: true };
};
const forgotPassword$1 = async (email) => {
	logContext$9.function = "forgotPassword";
	const user = await findUserByEmail(email);
	if (!user) return { isEmailSent: true };
	if (!user.isActive) throw new ValidationError({
		message: "Account is deactivated",
		code: "VALIDATION_ERROR"
	});
	const token = generateVerificationCode();
	const resetPasswordUrl = `${config.sendGridTemplateParameters[config.sendResetPasswordCodeV1TemplateId].reset_pswd_button_link}?token=${token.code}&email=${email}`;
	await sendResetPasswordEmail(email, user.firstName + " " + user.lastName, resetPasswordUrl);
	await updateUserVerifyCode(email, token.hashedCode, token.expiresAt);
	logger.info(logContext$9, "Password reset code generated — dev-only log", {
		email,
		code: token.code,
		resetPasswordUrl
	});
	return { isEmailSent: true };
};
const resetPassword$1 = async (data) => {
	logContext$9.function = "resetPassword";
	const { email, code, newPassword } = data;
	const user = await findUserByVerifyCodeHash(email, hashCode(code));
	if (!user) throw new ValidationError({
		message: "Invalid verification code",
		code: "VALIDATION_ERROR"
	});
	if (!(await findUserByEmail(email))?.isActive) throw new ValidationError({
		message: "Account is deactivated",
		code: "VALIDATION_ERROR"
	});
	if (!user.verifyCodeExpiry || isCodeExpired(user.verifyCodeExpiry)) throw new ValidationError({
		message: "Verification code has expired",
		code: "VALIDATION_ERROR"
	});
	if (!verifyCode(code, user.verifyCodeHash)) throw new ValidationError({
		message: "Invalid verification code",
		code: "VALIDATION_ERROR"
	});
	const newHashedPassword = await hashPassword(newPassword);
	await updateUserPasswordAndClearCode(user.userId, newHashedPassword);
	return { success: true };
};
const verifyEmail = async (data) => {
	logContext$9.function = "verifyEmail";
	const { code, email } = data;
	const user = await findUserByVerifyCodeHash(email, hashCode(code));
	if (!user) throw new ValidationError({
		message: "Invalid verification code",
		code: "VALIDATION_ERROR"
	});
	if (!user.verifyCodeExpiry || isCodeExpired(user.verifyCodeExpiry)) throw new ValidationError({
		message: "Verification code has expired",
		code: "VALIDATION_ERROR"
	});
	if (!verifyCode(code, user.verifyCodeHash)) throw new ValidationError({
		message: "Invalid verification code",
		code: "VALIDATION_ERROR"
	});
	const updatedUser = await verifyUserEmail(user.email);
	const accessToken = generateAccessToken({
		email: updatedUser.email,
		sub: updatedUser.userId,
		role: updatedUser.role
	});
	const refreshToken = generateRefreshToken({
		email: updatedUser.email,
		sub: updatedUser.userId,
		role: updatedUser.role
	});
	const session = await upsertSession({
		userId: updatedUser.userId,
		accessTokenId: accessToken.jti ?? null,
		accessTokenExpiry: accessToken.expiresAt ?? null,
		refreshTokenId: refreshToken.jti ?? null,
		refreshTokenExpiry: refreshToken.expiresAt ?? null
	});
	logger.info(logContext$9, "Email verified successfully", { email: user.email });
	return {
		user: updatedUser,
		session: {
			...session,
			accessToken: accessToken.token,
			refreshToken: refreshToken.token
		}
	};
};
const validateAccessToken = async (token) => {
	logContext$9.function = "validateAccessToken";
	const { email, role, sub, jti } = verifyAccessToken(token);
	if (!email) throw new UnauthorizedError({ message: "Invalid token" });
	if (!jti) throw new UnauthorizedError({ message: "Invalid token" });
	const session = await findUserSessionByAccessTokenId(jti, sub);
	if (!session) throw new UnauthorizedError({ message: "Invalid token" });
	return {
		user: {
			email,
			role,
			userId: sub
		},
		session
	};
};
const refreshAccessToken = async (refreshToken) => {
	logContext$9.function = "refreshAccessToken";
	const { sub: userId, email, role, jti } = verifyRefreshToken(refreshToken);
	if (!jti) throw new UnauthorizedError({ message: "Invalid refresh token: missing jti" });
	if (!await findUserSessionByRefreshTokenId(jti, userId)) throw new UnauthorizedError({ message: "Refresh token is not recognised or has been revoked" });
	const accessTokenObj = generateAccessToken({
		email,
		sub: userId,
		role
	});
	const refreshTokenObj = generateRefreshToken({
		email,
		sub: userId,
		role
	});
	await upsertSession({
		userId,
		accessTokenId: accessTokenObj.jti ?? null,
		accessTokenExpiry: accessTokenObj.expiresAt ?? null,
		refreshTokenId: refreshTokenObj.jti ?? null,
		refreshTokenExpiry: refreshTokenObj.expiresAt ?? null
	});
	logger.info(logContext$9, "Access token refreshed", { userId });
	return {
		accessToken: accessTokenObj.token,
		refreshToken: refreshTokenObj.token,
		expiresAt: accessTokenObj.expiresAt
	};
};
/**
* Logs in an existing user or registers a new one via an SSO provider.
* Lookup order:
*   1. Find by provider-specific ID (googleId / facebookId)
*   2. Auto-link: find by email and attach SSO identity
*   3. Create brand-new SSO-only user
* In all cases a JWT session is upserted and returned.
*/
const loginOrRegisterSsoUser = async (profile) => {
	logContext$9.function = "loginOrRegisterSsoUser";
	const { provider, id, email, firstName, lastName } = profile;
	const user = (provider === "google" ? await findUserByGoogleId(id) : await findUserByFacebookId(id)) ?? await upsertSsoUser({
		email,
		firstName,
		lastName,
		googleId: provider === "google" ? id : void 0,
		facebookId: provider === "facebook" ? id : void 0
	});
	if (!user.isActive) throw new ValidationError({
		message: "Account is deactivated",
		code: "VALIDATION_ERROR"
	});
	const accessTokenObj = generateAccessToken({
		email: user.email,
		sub: user.userId,
		role: user.role
	});
	const refreshTokenObj = generateRefreshToken({
		email: user.email,
		sub: user.userId,
		role: user.role
	});
	const currentSession = await upsertSession({
		userId: user.userId,
		accessTokenId: accessTokenObj?.jti ?? null,
		refreshTokenId: refreshTokenObj?.jti ?? null,
		accessTokenExpiry: accessTokenObj.expiresAt ?? null,
		refreshTokenExpiry: refreshTokenObj.expiresAt ?? null
	});
	logger.info(logContext$9, "SSO login successful", {
		provider,
		userId: user.userId
	});
	return {
		user,
		session: {
			currentSession,
			accessToken: accessTokenObj.token,
			refreshToken: refreshTokenObj.token
		}
	};
};

//#endregion
//#region src/middleware/auth.middleware.ts
const authenticate = async (req, _res, next) => {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) throw new UnauthorizedError({ message: "No token provided" });
	const { user, session } = await validateAccessToken(token);
	req.user = {
		userId: user.userId,
		email: user.email,
		role: user.role,
		accessTokenId: session?.accessTokenId ?? ""
	};
	next();
};
const authorize = (...pems) => {
	return (req, _res, next) => {
		const { user } = req;
		const { userId, role } = user || {};
		if (!user && !userId && !role) throw new UnauthorizedError({ message: "No user authenticated" });
		if (!pems.some((each) => permissions[each].includes(role))) throw new UnauthorizedError({ message: "Insufficient permissions" });
		next();
	};
};
/**
* Middleware to ensure the authenticated user ID matches the requested user ID.
* It searches the request object sequentially using the provided keys
* (e.g., ['params.userId', 'body.userId', 'query.userId']).
*/
const requireMatchingUser = (keys) => {
	return (req, _res, next) => {
		if (!req.user?.userId) throw new UnauthorizedError({ message: "User authorization required" });
		const { userId: authenticatedUserId } = req.user;
		let requestUserId;
		for (const key of keys) {
			const parts = key.split(".");
			let current = req;
			for (const part of parts) {
				if (current === void 0 || current === null) break;
				current = current[part];
			}
			if (typeof current === "string") {
				requestUserId = current;
				break;
			}
		}
		if (!requestUserId) throw new UnauthorizedError({ message: "No userId found in request using provided keys" });
		if (authenticatedUserId !== requestUserId) throw new UnauthorizedError({ message: "Authenticated user does not match the requested userId" });
		next();
	};
};

//#endregion
//#region src/services/review.service.ts
const reviewStore = /* @__PURE__ */ new Map();
const calculateOverallRating = (data) => {
	const values = [
		data.safety_rating,
		data.transport_rating,
		data.amenities_rating,
		data.value_rating
	].filter((value) => typeof value === "number");
	if (values.length === 0) return 0;
	return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};
const findAllReviews = async () => {
	return (await prisma.reviews.findMany({
		where: { status: "APPROVED" },
		orderBy: { created_at: "desc" },
		include: { users: { select: { firstName: true } } }
	})).map((review) => review.anonymous ? {
		...review,
		users: null
	} : review);
};
const findReviewById = async (id) => {
	try {
		return await prisma.reviews.findUnique({ where: { review_id: id } });
	} catch {
		return reviewStore.get(id) ?? null;
	}
};
const findApprovedReviewsByPostcode = async (postcodeId) => {
	return (await prisma.reviews.findMany({
		where: {
			postcode_id: postcodeId,
			status: "APPROVED"
		},
		orderBy: { created_at: "desc" },
		include: { users: { select: { firstName: true } } }
	})).map((review) => review.anonymous ? {
		...review,
		users: null
	} : review);
};
const createReview$1 = async (data, authorId, persist = async (review) => {
	return prisma.reviews.create({ data: {
		...review,
		users: void 0
	} });
}) => {
	const now = /* @__PURE__ */ new Date();
	return persist({
		review_id: crypto.randomUUID(),
		title: data.title,
		content: data.content,
		safety_rating: data.safety_rating,
		transport_rating: data.transport_rating,
		amenities_rating: data.amenities_rating,
		value_rating: data.value_rating,
		overall_rating: calculateOverallRating(data),
		pros: data.pros,
		cons: data.cons,
		years_lived: data.years_lived,
		anonymous: data.anonymous,
		verified: false,
		status: "PENDING",
		rejection_reason: null,
		author_id: authorId,
		postcode_id: data.postcode_id,
		borough_id: data.borough_id,
		created_at: now,
		updated_at: now,
		published_at: null
	});
};
const updateReview$1 = async (id, data) => {
	const existing = await findReviewById(id);
	if (!existing) return null;
	const next = {
		...existing,
		...data,
		overall_rating: calculateOverallRating({
			...existing,
			...data
		}),
		updated_at: /* @__PURE__ */ new Date()
	};
	try {
		const updated = await prisma.reviews.update({
			where: { review_id: id },
			data: next
		});
		reviewStore.set(id, updated);
		return updated;
	} catch {
		reviewStore.set(id, next);
		return next;
	}
};
const deleteReview$1 = async (id) => {
	try {
		await prisma.reviews.delete({ where: { review_id: id } });
		reviewStore.delete(id);
		return true;
	} catch {
		return reviewStore.delete(id);
	}
};

//#endregion
//#region src/controllers/review.controller.ts
const getAllReviews = async (req, res) => {
	try {
		let data;
		if (req.query.postcodeId !== void 0) {
			if (typeof req.query.postcodeId !== "string" || !req.query.postcodeId.trim()) {
				res.status(400).json({
					success: false,
					statusCode: 400,
					error: "A valid postcodeId is required"
				});
				return;
			}
			data = await findApprovedReviewsByPostcode(req.query.postcodeId.trim());
		} else data = await findAllReviews();
		const response = {
			success: true,
			statusCode: 200,
			data,
			message: "Reviews fetched successfully"
		};
		res.status(200).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal server error";
		res.status(500).json({
			success: false,
			statusCode: 500,
			error: message
		});
	}
};
const getReviewById = async (req, res) => {
	try {
		const data = await findReviewById(String(req.params.id ?? ""));
		if (!data) {
			res.status(404).json({
				success: false,
				statusCode: 404,
				error: "Review not found"
			});
			return;
		}
		const response = {
			success: true,
			statusCode: 200,
			data,
			message: "Review fetched successfully"
		};
		res.status(200).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal server error";
		res.status(500).json({
			success: false,
			statusCode: 500,
			error: message
		});
	}
};
const createReview = async (req, res) => {
	const body = req.body;
	const isRating = (value) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
	const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
	if (typeof body.title !== "string" || !body.title.trim() || typeof body.content !== "string" || !body.content.trim() || !isRating(body.safety_rating) || !isRating(body.transport_rating) || !isRating(body.amenities_rating) || !isRating(body.value_rating) || typeof body.postcode_id !== "string" || !body.postcode_id.trim() || body.pros !== void 0 && !isStringArray(body.pros) || body.cons !== void 0 && !isStringArray(body.cons) || body.years_lived !== void 0 && body.years_lived !== null && (!Number.isInteger(body.years_lived) || Number(body.years_lived) < 0 || Number(body.years_lived) > 100) || body.anonymous !== void 0 && typeof body.anonymous !== "boolean" || body.borough_id !== void 0 && body.borough_id !== null && typeof body.borough_id !== "string") {
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: "Review details are invalid or incomplete"
		});
		return;
	}
	const reviewInput = {
		title: body.title.trim(),
		content: body.content.trim(),
		safety_rating: body.safety_rating,
		transport_rating: body.transport_rating,
		amenities_rating: body.amenities_rating,
		value_rating: body.value_rating,
		pros: body.pros ?? [],
		cons: body.cons ?? [],
		years_lived: typeof body.years_lived === "number" ? body.years_lived : null,
		anonymous: body.anonymous === true,
		postcode_id: body.postcode_id.trim(),
		borough_id: body.borough_id ?? null
	};
	const authorId = req.user?.userId;
	if (!authorId) {
		res.status(401).json({
			success: false,
			statusCode: 401,
			error: "Authentication is required to submit a review"
		});
		return;
	}
	try {
		const response = {
			success: true,
			statusCode: 201,
			data: await createReview$1(reviewInput, authorId),
			message: "Review created successfully"
		};
		res.status(201).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to create review";
		res.status(500).json({
			success: false,
			statusCode: 500,
			error: message
		});
	}
};
const updateReview = async (req, res) => {
	try {
		const data = await updateReview$1(String(req.params.id ?? ""), req.body);
		if (!data) {
			res.status(404).json({
				success: false,
				statusCode: 404,
				error: "Review not found"
			});
			return;
		}
		const response = {
			success: true,
			statusCode: 200,
			data,
			message: "Review updated successfully"
		};
		res.status(200).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to update review";
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: message
		});
	}
};
const deleteReview = async (req, res) => {
	try {
		const deleted = await deleteReview$1(String(req.params.id ?? ""));
		const response = {
			success: deleted,
			statusCode: deleted ? 200 : 404,
			data: null,
			message: deleted ? "Review deleted successfully" : "Review not found"
		};
		res.status(response.statusCode).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to delete review";
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: message
		});
	}
};

//#endregion
//#region src/routes/review.routes.ts
/**
* @swagger
* tags:
*   name: Reviews
*   description: Property reviews and ratings
*/
const router$31 = Router();
/**
* @swagger
* /reviews:
*   get:
*     summary: Get all reviews
*     tags: [Reviews]
*     responses:
*       200:
*         description: List of reviews
*/
router$31.get("/", getAllReviews);
/**
* @swagger
* /reviews/{id}:
*   get:
*     summary: Get review by ID
*     tags: [Reviews]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: Review found
*/
router$31.get("/:id", getReviewById);
/**
* @swagger
* /reviews:
*   post:
*     summary: Create a new review
*     tags: [Reviews]
*     responses:
*       201:
*         description: Review created successfully
*/
router$31.post("/", authenticate, createReview);
/**
* @swagger
* /reviews/{id}:
*   put:
*     summary: Update review by ID
*     tags: [Reviews]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: Review updated successfully
*/
router$31.put("/:id", updateReview);
/**
* @swagger
* /reviews/{id}:
*   delete:
*     summary: Delete review by ID
*     tags: [Reviews]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: Review deleted successfully
*/
router$31.delete("/:id", deleteReview);

//#endregion
//#region src/controllers/user.controller.ts
const getAllUsers = async (req, res) => {
	try {
		const { page = 1, limit = 10 } = req.query;
		const { users } = await findAllUsers({
			page: Number(page),
			limit: Number(limit)
		});
		const resultant = {
			message: "Get all users",
			data: { users },
			statusCode: 200,
			success: true
		};
		res.status(resultant.statusCode).json(resultant);
	} catch {
		res.status(500).json({ error: "Internal server error" });
	}
};
const getUserById = async (req, res) => {
	try {
		const { id } = req.params;
		res.status(200).json({ message: `Get user by id: ${id}` });
	} catch {
		res.status(500).json({ error: "Internal server error" });
	}
};
const createUser = async (req, res) => {
	try {
		res.status(201).json({
			message: "Create user",
			data: req.body
		});
	} catch {
		res.status(500).json({ error: "Internal server error" });
	}
};
const updateUser = async (req, res) => {
	try {
		const { id } = req.params;
		res.status(200).json({
			message: `Update user: ${id}`,
			data: req.body
		});
	} catch {
		res.status(500).json({ error: "Internal server error" });
	}
};
const deleteUser = async (req, res) => {
	try {
		const { id } = req.params;
		res.status(200).json({ message: `Delete user: ${id}` });
	} catch {
		res.status(500).json({ error: "Internal server error" });
	}
};
const changePassword = async (req, res) => {
	const { userId } = req.params;
	await changePassword$1(userId, req.body);
	res.status(200).json({
		message: "Password changed successfully",
		data: null,
		statusCode: 200,
		success: true
	});
};

//#endregion
//#region src/middleware/validation.middleware.ts
const validateRequest = (schemas) => {
	return (req, _res, next) => {
		try {
			if (schemas.body) schemas.body.parse(req.body);
			if (schemas.params) schemas.params.parse(req.params);
			if (schemas.query) schemas.query.parse(req.query);
			return next();
		} catch (error) {
			let data = null;
			if (error instanceof ZodError) data = error.issues || [];
			return next(new ValidationError({
				message: "Invalid request data",
				code: "VALIDATION_ERROR",
				data
			}));
		}
	};
};

//#endregion
//#region src/dto/user.dto.ts
const ChangePasswordDto = object({
	oldPassword: string().min(6),
	newPassword: string().min(6)
});

//#endregion
//#region src/routes/user.routes.ts
/**
* @swagger
* tags:
*   name: Users
*   description: User management and profile operations
*/
/**
* @swagger
* components:
*   schemas:
*     ChangePasswordDto:
*       type: object
*       required:
*         - oldPassword
*         - newPassword
*       properties:
*         oldPassword:
*           type: string
*           minLength: 6
*         newPassword:
*           type: string
*           minLength: 6
*     User:
*       type: object
*       properties:
*         id:
*           type: string
*           format: uuid
*         email:
*           type: string
*           format: email
*         firstName:
*           type: string
*         lastName:
*           type: string
*         role:
*           type: string
*/
const router$30 = Router();
/**
* @swagger
* /users:
*   get:
*     summary: Get all users
*     tags: [Users]
*     security:
*       - bearerAuth: []
*     responses:
*       200:
*         description: List of users fetched successfully
*/
router$30.get("/", authenticate, authorize("view:users:all"), getAllUsers);
/**
* @swagger
* /users/{id}:
*   get:
*     summary: Get user by ID
*     tags: [Users]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*           format: uuid
*     responses:
*       200:
*         description: User found
*/
router$30.get("/:id", authenticate, authorize("view:users:all"), getUserById);
/**
* @swagger
* /users:
*   post:
*     summary: Create a new user
*     tags: [Users]
*     responses:
*       201:
*         description: User created successfully
*/
router$30.post("/", authenticate, authorize("manage:users"), createUser);
/**
* @swagger
* /users/{id}:
*   put:
*     summary: Update user by ID
*     tags: [Users]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*           format: uuid
*     responses:
*       200:
*         description: User updated successfully
*/
router$30.put("/:id", authenticate, authorize("manage:users"), updateUser);
/**
* @swagger
* /users/{id}:
*   delete:
*     summary: Delete user by ID
*     tags: [Users]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*           format: uuid
*     responses:
*       200:
*         description: User deleted successfully
*/
router$30.delete("/:id", authenticate, authorize("manage:users"), deleteUser);
/**
* @swagger
* /users/{userId}/change-password:
*   post:
*     summary: Change user password
*     tags: [Users]
*     security:
*       - bearerAuth: []
*     parameters:
*       - in: path
*         name: userId
*         required: true
*         schema:
*           type: string
*           format: uuid
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/ChangePasswordDto'
*     responses:
*       200:
*         description: Password changed successfully
*/
router$30.post("/:userId/change-password", authenticate, validateRequest({ body: ChangePasswordDto }), requireMatchingUser(["params.userId"]), changePassword);

//#endregion
//#region src/services/property.service.ts
const propertyStore = /* @__PURE__ */ new Map();
const toNumber = (value) => {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value.replace(/[^0-9.-]/g, ""));
		return Number.isFinite(parsed) ? parsed : void 0;
	}
};
const findAllProperties = async () => {
	try {
		return await prisma.properties.findMany({ orderBy: { created_at: "desc" } });
	} catch {
		return Array.from(propertyStore.values());
	}
};
const findPropertyById = async (id) => {
	try {
		return await prisma.properties.findUnique({ where: { property_id: id } });
	} catch {
		return propertyStore.get(id) ?? null;
	}
};
const createProperty$1 = async (data) => {
	const now = /* @__PURE__ */ new Date();
	const property = {
		property_id: data.property_id ?? crypto.randomUUID(),
		title: data.title ?? "Untitled property",
		description: data.description ?? "",
		type: data.type ?? "FLAT",
		listing_type: data.listing_type ?? "FOR_RENT",
		price: toNumber(data.price) ?? 0,
		price_frequency: data.price_frequency ?? "MONTHLY",
		bedrooms: Number(data.bedrooms ?? 0),
		bathrooms: Number(data.bathrooms ?? 0),
		size: data.size ?? null,
		furnished: data.furnished ?? "UNFURNISHED",
		address: data.address ?? "",
		latitude: data.latitude ?? null,
		longitude: data.longitude ?? null,
		features: data.features ?? [],
		available_from: data.available_from ?? null,
		min_tenancy: data.min_tenancy ?? null,
		deposit: data.deposit ?? null,
		bills: data.bills ?? "EXCLUDED",
		epc_rating: data.epc_rating ?? null,
		floor_plan: data.floor_plan ?? null,
		verified: data.verified ?? false,
		featured: data.featured ?? false,
		status: data.status ?? "ACTIVE",
		view_count: data.view_count ?? 0,
		landlord_id: data.landlord_id ?? "00000000-0000-4000-8000-000000000000",
		postcode_id: data.postcode_id ?? "00000000-0000-4000-8000-000000000000",
		created_at: now,
		updated_at: now
	};
	try {
		const saved = await prisma.properties.create({ data: property });
		propertyStore.set(saved.property_id, saved);
		return saved;
	} catch {
		propertyStore.set(property.property_id, property);
		return property;
	}
};
const updateProperty$1 = async (id, data) => {
	const existing = await findPropertyById(id);
	if (!existing) return null;
	const next = {
		...existing,
		...data,
		updated_at: /* @__PURE__ */ new Date()
	};
	try {
		const updated = await prisma.properties.update({
			where: { property_id: id },
			data: next
		});
		propertyStore.set(id, updated);
		return updated;
	} catch {
		propertyStore.set(id, next);
		return next;
	}
};
const deleteProperty$1 = async (id) => {
	try {
		await prisma.properties.delete({ where: { property_id: id } });
		propertyStore.delete(id);
		return true;
	} catch {
		return propertyStore.delete(id);
	}
};

//#endregion
//#region src/controllers/property.controller.ts
const getAllProperties = async (_req, res) => {
	try {
		const response = {
			success: true,
			statusCode: 200,
			data: await findAllProperties(),
			message: "Properties fetched successfully"
		};
		res.status(200).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal server error";
		res.status(500).json({
			success: false,
			statusCode: 500,
			error: message
		});
	}
};
const getPropertyById = async (req, res) => {
	try {
		const data = await findPropertyById(String(req.params.id ?? ""));
		if (!data) {
			res.status(404).json({
				success: false,
				statusCode: 404,
				error: "Property not found"
			});
			return;
		}
		const response = {
			success: true,
			statusCode: 200,
			data,
			message: "Property fetched successfully"
		};
		res.status(200).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal server error";
		res.status(500).json({
			success: false,
			statusCode: 500,
			error: message
		});
	}
};
const createProperty = async (req, res) => {
	try {
		const response = {
			success: true,
			statusCode: 201,
			data: await createProperty$1(req.body),
			message: "Property created successfully"
		};
		res.status(201).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to create property";
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: message
		});
	}
};
const updateProperty = async (req, res) => {
	try {
		const data = await updateProperty$1(String(req.params.id ?? ""), req.body);
		if (!data) {
			res.status(404).json({
				success: false,
				statusCode: 404,
				error: "Property not found"
			});
			return;
		}
		const response = {
			success: true,
			statusCode: 200,
			data,
			message: "Property updated successfully"
		};
		res.status(200).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to update property";
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: message
		});
	}
};
const deleteProperty = async (req, res) => {
	try {
		const deleted = await deleteProperty$1(String(req.params.id ?? ""));
		const response = {
			success: deleted,
			statusCode: deleted ? 200 : 404,
			data: null,
			message: deleted ? "Property deleted successfully" : "Property not found"
		};
		res.status(response.statusCode).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to delete property";
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: message
		});
	}
};

//#endregion
//#region src/routes/property.routes.ts
/**
* @swagger
* tags:
*   name: Properties
*   description: Property listing and management
*/
const router$29 = Router();
/**
* @swagger
* /properties:
*   get:
*     summary: Get all properties
*     tags: [Properties]
*     responses:
*       200:
*         description: List of properties
*/
router$29.get("/", getAllProperties);
/**
* @swagger
* /properties/{id}:
*   get:
*     summary: Get property by ID
*     tags: [Properties]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: Property details
*/
router$29.get("/:id", getPropertyById);
/**
* @swagger
* /properties:
*   post:
*     summary: Create a new property
*     tags: [Properties]
*     responses:
*       201:
*         description: Property created successfully
*/
router$29.post("/", createProperty);
/**
* @swagger
* /properties/{id}:
*   put:
*     summary: Update property by ID
*     tags: [Properties]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: Property updated successfully
*/
router$29.put("/:id", updateProperty);
/**
* @swagger
* /properties/{id}:
*   delete:
*     summary: Delete property by ID
*     tags: [Properties]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: Property deleted successfully
*/
router$29.delete("/:id", deleteProperty);

//#endregion
//#region src/controllers/auth.controller.ts
const logContext$8 = {
	service: "AuthController",
	function: ""
};
const register = async (req, res) => {
	try {
		const { user, session } = await registerUser(req.body);
		const resultant = {
			success: true,
			statusCode: 201,
			message: "User registered successfully",
			data: {
				user,
				session
			}
		};
		return res.status(resultant.statusCode).json(resultant);
	} catch (error) {
		logContext$8.function = "register";
		logger.error(logContext$8, "Error in register controller", { error });
		throw error;
	}
};
const registerEarlyAccess = async (req, res) => {
	try {
		const resultant = {
			success: true,
			statusCode: 201,
			message: "Early access account created successfully",
			data: await registerEarlyAccessUser(req.body)
		};
		return res.status(resultant.statusCode).json(resultant);
	} catch (error) {
		logContext$8.function = "registerEarlyAccess";
		logger.error(logContext$8, "Error in early access registration", { error });
		throw error;
	}
};
const login = async (req, res) => {
	try {
		const { session, user } = await loginUser(req.body.email, req.body.password);
		const resultant = {
			success: session ? true : false,
			statusCode: session ? 200 : 401,
			message: session ? "User logged in successfully" : "Invalid credentials",
			data: session ? {
				user,
				session
			} : void 0
		};
		return res.status(resultant.statusCode).json(resultant);
	} catch (error) {
		logContext$8.function = "login";
		logger.error(logContext$8, "Error in login controller", { error });
		throw error;
	}
};
const logout = async (req, res) => {
	try {
		const result = await logoutUser(req.body?.userId);
		const resultant = {
			success: !!result,
			statusCode: result ? 200 : 400,
			message: result ? "User logged out successfully" : "Logout failed",
			data: null
		};
		return res.status(resultant.statusCode).json(resultant);
	} catch (error) {
		logContext$8.function = "logout";
		logger.error(logContext$8, "Error in logout controller", { error });
		throw error;
	}
};
const emailVerifyReset = async (req, res) => {
	try {
		const { isNewCodeGenerated } = await resetEmailVerification(req.body.email);
		const resultant = {
			success: true,
			statusCode: 201,
			message: "Verification code sent successfully",
			data: { isNewCodeGenerated }
		};
		return res.status(201).json(resultant);
	} catch (error) {
		logContext$8.function = "emailVerifyReset";
		logger.error(logContext$8, "Error in emailVerifyReset controller", { error });
		throw error;
	}
};
const emailVerify = async (req, res) => {
	try {
		const { user, session } = await verifyEmail(req?.query);
		const resultant = {
			success: true,
			statusCode: 200,
			message: "Email verified successfully",
			data: {
				user,
				session
			}
		};
		return res.status(200).json(resultant);
	} catch (error) {
		logContext$8.function = "emailVerify";
		logger.error(logContext$8, "Error in emailVerify controller", { error });
		throw error;
	}
};
const refresh = async (req, res) => {
	try {
		const { refreshToken } = req.body;
		const { accessToken, refreshToken: newRefreshToken, expiresAt } = await refreshAccessToken(refreshToken);
		const resultant = {
			success: true,
			statusCode: 200,
			message: "Access token refreshed successfully",
			data: { session: {
				accessToken,
				refreshToken: newRefreshToken,
				expiresAt
			} }
		};
		return res.status(200).json(resultant);
	} catch (error) {
		logContext$8.function = "refresh";
		logger.error(logContext$8, "Error in refresh controller", { error });
		throw error;
	}
};
const resetPassword = async (req, res) => {
	try {
		await resetPassword$1(req.body);
		return res.status(200).json({
			success: true,
			statusCode: 200,
			message: "Password reset successfully",
			data: null
		});
	} catch (error) {
		logContext$8.function = "resetPassword";
		logger.error(logContext$8, "Error in resetPassword controller", { error });
		throw error;
	}
};
const forgotPassword = async (req, res) => {
	try {
		const { email } = req.body;
		await forgotPassword$1(email);
		return res.status(200).json({
			success: true,
			statusCode: 200,
			message: "If the email exists, a password reset code has been sent.",
			data: null
		});
	} catch (error) {
		logContext$8.function = "forgotPassword";
		logger.error(logContext$8, "Error in forgotPassword controller", { error });
		throw error;
	}
};
const getMe = async (req, res) => {
	try {
		const { user } = req;
		const profile = await getCurrentUserProfile(user.userId);
		if (!profile) throw new EntityNotFoundError({
			message: "User not found",
			code: "ENTITY_NOT_FOUND"
		});
		const resultant = {
			success: true,
			statusCode: 200,
			message: "User fetched successfully",
			data: profile
		};
		return res.status(200).json(resultant);
	} catch (error) {
		logContext$8.function = "getMe";
		logger.error(logContext$8, "Error in getMe controller", { error });
		throw error;
	}
};

//#endregion
//#region src/dto/auth.dto.ts
const RegisterUserDto = object({
	email: email({ pattern: regexes.email }),
	password: string().min(6),
	firstName: string().min(1),
	lastName: string().min(1),
	role: enum$1([
		UserRole["LANDLORD"],
		UserRole["TENANT"],
		UserRole["AGENCY"],
		UserRole["AGENT"]
	]),
	agencyName: string().optional(),
	agencyDescription: string().optional(),
	agencyEmail: string().optional(),
	agencyPhone: string().optional(),
	agencyWebsite: string().optional()
}).superRefine((data, ctx) => {
	if ((data.role === UserRole["AGENCY"] || data.role === UserRole["AGENT"]) && (!data.agencyName || data.agencyName.trim().length === 0)) ctx.addIssue({
		code: "custom",
		message: "Agency name is required for agency or agent role",
		path: ["agencyName"]
	});
});
const EarlyAccessRegisterDto = object({
	firstName: string().trim().min(1),
	lastName: string().trim().min(1),
	email: email({ pattern: regexes.email }),
	password: string().min(8)
});
const LoginUserDto = object({
	email: email({ pattern: regexes.email }),
	password: string().min(6)
});
const LogoutUserDto = object({ userId: uuid() });
const VerifyEmailDto = object({ email: email({ pattern: regexes.email }) });
const VerifyEmailCodeDto = object({
	code: string().length(6),
	email: email({ pattern: regexes.email })
});
const RefreshTokenDto = object({ refreshToken: string().min(1) });
const ForgotPasswordDto = object({ email: email({ pattern: regexes.email }) });
const ResetPasswordDto = object({
	email: email({ pattern: regexes.email }),
	code: string().length(6),
	newPassword: string().min(6)
});

//#endregion
//#region src/routes/auth.routes.ts
/**
* @swagger
* tags:
*   name: Auth
*   description: Authentication and authorization management
*/
/**
* @swagger
* components:
*   schemas:
*     EarlyAccessRegisterDto:
*       type: object
*       required: [firstName, lastName, email, password]
*       properties:
*         firstName:
*           type: string
*         lastName:
*           type: string
*         email:
*           type: string
*           format: email
*         password:
*           type: string
*           minLength: 8
*     RegisterUserDto:
*       type: object
*       required:
*         - email
*         - password
*         - firstName
*         - lastName
*         - role
*       properties:
*         email:
*           type: string
*           format: email
*         password:
*           type: string
*           minLength: 6
*         firstName:
*           type: string
*         lastName:
*           type: string
*         role:
*           type: string
*           enum: [LANDLORD, TENANT, AGENCY, AGENT]
*         agencyName:
*           type: string
*         agencyDescription:
*           type: string
*         agencyEmail:
*           type: string
*         agencyPhone:
*           type: string
*         agencyWebsite:
*           type: string
*     LoginUserDto:
*       type: object
*       required:
*         - email
*         - password
*       properties:
*         email:
*           type: string
*           format: email
*         password:
*           type: string
*           format: password
*     ApiResponse:
*       type: object
*       properties:
*         success:
*           type: boolean
*         statusCode:
*           type: number
*         message:
*           type: string
*         data:
*           type: object
*         error:
*           type: string
*/
const router$28 = Router();
/**
* @swagger
* /auth/register:
*   post:
*     summary: Register a new user
*     tags: [Auth]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/RegisterUserDto'
*     responses:
*       201:
*         description: User registered successfully
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ApiResponse'
*       400:
*         description: Bad request
*/
router$28.post("/register", validateRequest({ body: RegisterUserDto }), register);
/**
* @swagger
* /auth/early-access:
*   post:
*     summary: Register for early access with an active 30-day trial
*     tags: [Auth]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/EarlyAccessRegisterDto'
*     responses:
*       201:
*         description: Account created with an active session and trial
*       400:
*         description: Invalid input or disposable email domain
*/
router$28.post("/early-access", validateRequest({ body: EarlyAccessRegisterDto }), registerEarlyAccess);
/**
* @swagger
* /auth/login:
*   post:
*     summary: Login a user
*     tags: [Auth]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/LoginUserDto'
*     responses:
*       200:
*         description: User logged in successfully
*       401:
*         description: Invalid credentials
*/
router$28.post("/login", validateRequest({ body: LoginUserDto }), login);
/**
* @swagger
* /auth/logout:
*   post:
*     summary: Logout a user
*     tags: [Auth]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               userId:
*                 type: string
*                 format: uuid
*     responses:
*       200:
*         description: User logged out successfully
*/
router$28.post("/logout", validateRequest({ body: LogoutUserDto }), logout);
/**
* @swagger
* /auth/email/verify/reset:
*   post:
*     summary: Request a new email verification code
*     tags: [Auth]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               email:
*                 type: string
*                 format: email
*     responses:
*       201:
*         description: Verification code sent successfully
*/
router$28.post("/email/verify/reset", validateRequest({ body: VerifyEmailDto }), emailVerifyReset);
/**
* @swagger
* /auth/email/verify:
*   get:
*     summary: Verify email with a code
*     tags: [Auth]
*     parameters:
*       - in: query
*         name: email
*         required: true
*         schema:
*           type: string
*           format: email
*       - in: query
*         name: code
*         required: true
*         schema:
*           type: string
*           minLength: 6
*           maxLength: 6
*           pattern: '^[0-9]{6}$'
*     responses:
*       200:
*         description: Email verified successfully
*/
router$28.get("/email/verify", validateRequest({ query: VerifyEmailCodeDto }), emailVerify);
/**
* @swagger
* /auth/refresh:
*   post:
*     summary: Refresh access token
*     tags: [Auth]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               userId:
*                 type: string
*                 format: uuid
*               refreshToken:
*                 type: string
*     responses:
*       200:
*         description: Access token refreshed successfully
*/
router$28.post("/refresh", validateRequest({ body: RefreshTokenDto }), refresh);
/**
* @swagger
* /auth/forgot-password:
*   post:
*     summary: Request a password reset
*     tags: [Auth]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               email:
*                 type: string
*                 format: email
*     responses:
*       200:
*         description: If the email exists, a password reset code has been sent.
*/
router$28.post("/forgot-password", validateRequest({ body: ForgotPasswordDto }), forgotPassword);
/**
* @swagger
* /auth/reset-password:
*   post:
*     summary: Reset password with a code
*     tags: [Auth]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               email:
*                 type: string
*                 format: email
*               code:
*                 type: string
*               newPassword:
*                 type: string
*                 minLength: 6
*     responses:
*       200:
*         description: Password reset successfully
*/
router$28.post("/reset-password", validateRequest({ body: ResetPasswordDto }), resetPassword);
/**
* @swagger
* /auth/me:
*   get:
*     summary: Get currently authenticated user
*     tags: [Auth]
*     security:
*       - bearerAuth: []
*     responses:
*       200:
*         description: User fetched successfully
*/
router$28.get("/me", authenticate, getMe);

//#endregion
//#region src/controllers/sso.controller.ts
const logContext$7 = {
	service: "SsoController",
	function: ""
};
/**
* Called after a successful OAuth callback.
* Redirects the browser to the frontend with JWT tokens in query params.
*/
const ssoCallback = (req, res) => {
	logContext$7.function = "ssoCallback";
	const payload = req.user;
	if (!payload) {
		logger.error(logContext$7, "SSO callback missing user payload");
		res.redirect(`${config.frontendUrl}/auth/sso/error?reason=missing_payload`);
		return;
	}
	const params = new URLSearchParams({
		accessToken: payload.accessToken,
		refreshToken: payload.refreshToken,
		userId: payload.userId,
		role: payload.role
	});
	logger.info(logContext$7, "SSO callback success — redirecting to frontend", { userId: payload.userId });
	res.redirect(`${config.frontendUrl}/auth/sso/callback?${params.toString()}`);
};
/**
* Called when Passport authentication fails (e.g. user denied OAuth consent).
* Redirects the browser to the frontend error page.
*/
const ssoFailure = (_req, res) => {
	logContext$7.function = "ssoFailure";
	logger.warn(logContext$7, "SSO authentication failed");
	res.redirect(`${config.frontendUrl}/auth/sso/error?reason=sso_failed`);
};
/**
* SSO logout — invalidates the JWT session for the authenticated user.
* Reuses the same logoutUser service as the email/password flow.
*/
const ssoLogout = async (req, res) => {
	logContext$7.function = "ssoLogout";
	const userId = req.user?.userId;
	if (!userId) return res.status(401).json({
		success: false,
		statusCode: 401,
		message: "No authenticated user found",
		data: null
	});
	await logoutUser(userId);
	return res.status(200).json({
		success: true,
		statusCode: 200,
		message: "Logged out successfully",
		data: null
	});
};

//#endregion
//#region src/routes/sso.routes.ts
/**
* sso.routes.ts
*
* Routes for Google and Facebook OAuth login, callbacks, logout, and /me.
* Mounted at /sso by the root router — full path is /api/v1/sso/...
*
* Flow overview:
*   1. Browser visits GET /api/v1/sso/google
*      → Passport redirects to Google
*   2. Google redirects back to GET /api/v1/sso/google/callback
*      → Passport runs strategy → loginOrRegisterSsoUser → ssoCallback
*      → ssoCallback redirects to frontend with ?accessToken=&refreshToken=&userId=
*   3. GET /api/v1/sso/logout  (requires Bearer token)
*      → invalidates session
*   4. GET /api/v1/sso/me      (requires Bearer token)
*      → returns authenticated user profile
*/
/**
* @swagger
* tags:
*   name: SSO
*   description: Single Sign-On operations (Google/Facebook OAuth)
*/
const router$27 = Router();
/**
* @swagger
* /sso/google:
*   get:
*     summary: Initiate Google OAuth login
*     tags: [SSO]
*     responses:
*       302:
*         description: Redirects to Google login screen
*/
router$27.get("/google", passport.authenticate("google", {
	session: false,
	scope: ["profile", "email"]
}));
/**
* @swagger
* /sso/google/callback:
*   get:
*     summary: Google OAuth callback
*     tags: [SSO]
*     responses:
*       302:
*         description: Redirects to frontend with tokens on success
*/
router$27.get("/google/callback", passport.authenticate("google", {
	session: false,
	failureRedirect: "/api/v1/sso/failure"
}), ssoCallback);
/**
* @swagger
* /sso/facebook:
*   get:
*     summary: Initiate Facebook OAuth login
*     tags: [SSO]
*     responses:
*       302:
*         description: Redirects to Facebook login screen
*/
router$27.get("/facebook", passport.authenticate("facebook", {
	session: false,
	scope: ["email"]
}));
/**
* @swagger
* /sso/facebook/callback:
*   get:
*     summary: Facebook OAuth callback
*     tags: [SSO]
*     responses:
*       302:
*         description: Redirects to frontend with tokens on success
*/
router$27.get("/facebook/callback", passport.authenticate("facebook", {
	session: false,
	failureRedirect: "/api/v1/sso/failure"
}), ssoCallback);
/**
* @swagger
* /sso/failure:
*   get:
*     summary: SSO failure landing page
*     tags: [SSO]
*     responses:
*       200:
*         description: Renders failure message or redirects
*/
router$27.get("/failure", ssoFailure);
/**
* @swagger
* /sso/logout:
*   get:
*     summary: SSO logout
*     tags: [SSO]
*     security:
*       - bearerAuth: []
*     responses:
*       200:
*         description: User logged out successfully
*/
router$27.get("/logout", authenticate, ssoLogout);
/**
* @swagger
* /sso/me:
*   get:
*     summary: Get authenticated SSO user profile
*     tags: [SSO]
*     security:
*       - bearerAuth: []
*     responses:
*       200:
*         description: User profile fetched successfully
*/
router$27.get("/me", authenticate, getMe);

//#endregion
//#region src/repositories/borough.repository.ts
const logContext$6 = {
	service: "BoroughRepository",
	function: ""
};
const createBorough$1 = async (borough, tx = prisma) => {
	return await tx.borough.create({ data: borough }).catch((err) => {
		logContext$6.function = "createBorough";
		logger.error(logContext$6, "Error in createBorough repository", { error: err });
		throw new Error("DB: borough create operation failed");
	});
};
const findBoroughById = async (boroughId, select) => {
	return await prisma.borough.findUnique({
		where: { boroughId },
		select: select || {
			boroughId: true,
			name: true,
			slug: true,
			description: true,
			image: true,
			latitude: true,
			longitude: true,
			metrics: true,
			createdAt: true,
			updatedAt: true
		}
	}).catch((err) => {
		logContext$6.function = "findBoroughById";
		logger.error(logContext$6, "Error in findBoroughById repository", { error: err });
		throw new Error("DB: findBoroughById operation failed");
	});
};
const findBoroughBySlug = async (slug, select) => {
	return await prisma.borough.findUnique({
		where: { slug },
		select: select || {
			boroughId: true,
			name: true,
			slug: true,
			description: true,
			image: true,
			latitude: true,
			longitude: true,
			metrics: true,
			createdAt: true,
			updatedAt: true
		}
	}).catch((err) => {
		logContext$6.function = "findBoroughBySlug";
		logger.error(logContext$6, "Error in findBoroughBySlug repository", { error: err });
		throw new Error("DB: findBoroughBySlug operation failed");
	});
};
const findBoroughByName = async (name) => {
	return await prisma.borough.findUnique({
		where: { name },
		select: {
			boroughId: true,
			name: true,
			slug: true
		}
	}).catch((err) => {
		logContext$6.function = "findBoroughByName";
		logger.error(logContext$6, "Error in findBoroughByName repository", {
			error: err,
			name
		});
		throw new Error("DB: borough lookup by name failed");
	});
};
const findAllBoroughs = async (limit, offset, select) => {
	return await prisma.borough.findMany({
		take: limit,
		skip: offset,
		orderBy: { name: "asc" },
		select: select || {
			boroughId: true,
			name: true,
			slug: true,
			description: true,
			image: true,
			metrics: true
		}
	}).catch((err) => {
		logContext$6.function = "findAllBoroughs";
		logger.error(logContext$6, "Error in findAllBoroughs repository", { error: err });
		throw new Error("DB: findAllBoroughs operation failed");
	});
};
const countBoroughs = async () => {
	return await prisma.borough.count().catch((err) => {
		logContext$6.function = "countBoroughs";
		logger.error(logContext$6, "Error in countBoroughs repository", { error: err });
		throw new Error("DB: countBoroughs operation failed");
	});
};
const updateBorough$1 = async (boroughId, data, tx = prisma) => {
	return await tx.borough.update({
		where: { boroughId },
		data
	}).catch((err) => {
		logContext$6.function = "updateBorough";
		logger.error(logContext$6, "Error in updateBorough repository", { error: err });
		throw new Error("DB: borough update operation failed");
	});
};
const deleteBorough$1 = async (boroughId, tx = prisma) => {
	return await tx.borough.delete({ where: { boroughId } }).catch((err) => {
		logContext$6.function = "deleteBorough";
		logger.error(logContext$6, "Error in deleteBorough repository", { error: err });
		throw new Error("DB: borough delete operation failed");
	});
};

//#endregion
//#region src/utils/postcode.ts
const normalizePostcodeCode = (code) => {
	return code.trim().toUpperCase().replace(/\s+/g, "");
};
const getPostcodeLookupCandidates = (code) => {
	const trimmed = code.trim().toUpperCase();
	const normalized = normalizePostcodeCode(code);
	const candidates = [trimmed, normalized];
	if (normalized.length >= 5 && !trimmed.includes(" ")) {
		const spacedFormat = normalized.slice(0, -3) + " " + normalized.slice(-3);
		candidates.push(spacedFormat);
	}
	return Array.from(new Set(candidates));
};

//#endregion
//#region src/repositories/postcode.repository.ts
const getPostcodeClient = (client = prisma) => {
	const postcodeClient = client.postcode;
	if (!postcodeClient) throw new Error("Postcode model is not available in the current Prisma schema");
	return postcodeClient;
};
const logContext$5 = {
	service: "PostcodeRepository",
	function: ""
};
const createPostcode$1 = async (postcode, tx = prisma) => {
	return await getPostcodeClient(tx).create({ data: postcode }).catch((err) => {
		logContext$5.function = "createPostcode";
		logger.error(logContext$5, "Error in createPostcode repository", { error: err });
		throw new Error("DB: postcode create operation failed");
	});
};
const findPostcodeById = async (postcodeId, select) => {
	return await getPostcodeClient().findUnique({
		where: { postcodeId },
		select: select || {
			postcodeId: true,
			code: true,
			outcode: true,
			incode: true,
			latitude: true,
			longitude: true,
			imageUrl: true,
			metrics: true,
			boroughId: true,
			createdAt: true,
			updatedAt: true
		}
	}).catch((err) => {
		logContext$5.function = "findPostcodeById";
		logger.error(logContext$5, "Error in findPostcodeById repository", { error: err });
		throw new Error("DB: findPostcodeById operation failed");
	});
};
const findPostcodeByCode = async (code, select) => {
	const candidates = getPostcodeLookupCandidates(code);
	const postcode = await getPostcodeClient().findUnique({
		where: { code: candidates[0] },
		select: select || {
			postcodeId: true,
			code: true,
			outcode: true,
			incode: true,
			latitude: true,
			longitude: true,
			imageUrl: true,
			metrics: true,
			boroughId: true,
			createdAt: true,
			updatedAt: true
		}
	}).catch((err) => {
		logContext$5.function = "findPostcodeByCode";
		logger.error(logContext$5, "Error in findPostcodeByCode repository", { error: err });
		throw new Error("DB: findPostcodeByCode operation failed");
	});
	if (postcode) return postcode;
	for (const candidate of candidates.slice(1)) {
		const fallback = await getPostcodeClient().findUnique({
			where: { code: candidate },
			select: select || {
				postcodeId: true,
				code: true,
				outcode: true,
				incode: true,
				latitude: true,
				longitude: true,
				imageUrl: true,
				metrics: true,
				boroughId: true,
				createdAt: true,
				updatedAt: true
			}
		}).catch((err) => {
			logContext$5.function = "findPostcodeByCode";
			logger.error(logContext$5, "Error in findPostcodeByCode repository", { error: err });
			throw new Error("DB: findPostcodeByCode operation failed");
		});
		if (fallback) return fallback;
	}
	return null;
};
const findAllPostcodes = async (limit, offset, filter, select) => {
	const where = {};
	if (filter?.outcode) where.outcode = filter.outcode;
	if (filter?.boroughId) where.boroughId = filter.boroughId;
	return await getPostcodeClient().findMany({
		where,
		take: limit,
		skip: offset,
		orderBy: { code: "asc" },
		select: select || {
			postcodeId: true,
			code: true,
			outcode: true,
			incode: true,
			latitude: true,
			longitude: true,
			imageUrl: true,
			boroughId: true
		}
	}).catch((err) => {
		logContext$5.function = "findAllPostcodes";
		logger.error(logContext$5, "Error in findAllPostcodes repository", { error: err });
		throw new Error("DB: findAllPostcodes operation failed");
	});
};
const countPostcodes = async (filter) => {
	const where = {};
	if (filter?.outcode) where.outcode = filter.outcode;
	if (filter?.boroughId) where.boroughId = filter.boroughId;
	return await getPostcodeClient().count({ where }).catch((err) => {
		logContext$5.function = "countPostcodes";
		logger.error(logContext$5, "Error in countPostcodes repository", { error: err });
		throw new Error("DB: countPostcodes operation failed");
	});
};
const updatePostcode$1 = async (postcodeId, data, tx = prisma) => {
	return await getPostcodeClient(tx).update({
		where: { postcodeId },
		data
	}).catch((err) => {
		logContext$5.function = "updatePostcode";
		logger.error(logContext$5, "Error in updatePostcode repository", { error: err });
		throw new Error("DB: postcode update operation failed");
	});
};
const deletePostcode$1 = async (postcodeId, tx = prisma) => {
	return await getPostcodeClient(tx).delete({ where: { postcodeId } }).catch((err) => {
		logContext$5.function = "deletePostcode";
		logger.error(logContext$5, "Error in deletePostcode repository", { error: err });
		throw new Error("DB: postcode delete operation failed");
	});
};

//#endregion
//#region src/repositories/data.repository.ts
const tableIdField = {
	crime_data: "crime_data_id",
	demography: "demography_id",
	property_value_data: "property_value_data_id",
	rent_data: "rent_data_id",
	voting_data: "voting_data_id"
};
const logContext$4 = {
	service: "DataRepository",
	function: ""
};
const getModelClient = (table, client = prisma) => {
	const modelClient = client[table];
	if (!modelClient) throw new Error(`Prisma model for table ${table} is not available`);
	return modelClient;
};
const findAllData = async (table, limit, offset, filters = {}) => {
	return await getModelClient(table).findMany({
		where: filters,
		take: limit,
		skip: offset,
		orderBy: { [tableIdField[table]]: "asc" }
	}).catch((err) => {
		logContext$4.function = "findAllData";
		logger.error(logContext$4, "Error in findAllData repository", {
			error: err,
			table,
			limit,
			offset,
			filters
		});
		throw new Error("DB: findAllData operation failed");
	});
};

//#endregion
//#region src/services/spaces-assets.service.ts
const resolveSpacesOriginEndpoint = (region, endpoint) => {
	const parsedEndpoint = new URL(endpoint);
	const regionalHost = `${region}.digitaloceanspaces.com`;
	return parsedEndpoint.hostname === regionalHost ? parsedEndpoint.origin : `https://${regionalHost}`;
};
const createSpacesObjectUrlSigner = (settings) => {
	const client = Boolean(settings.accessKeyId && settings.secretAccessKey) ? new S3Client({
		region: settings.region,
		endpoint: resolveSpacesOriginEndpoint(settings.region, settings.endpoint),
		credentials: {
			accessKeyId: settings.accessKeyId,
			secretAccessKey: settings.secretAccessKey
		}
	}) : null;
	return async (key) => {
		if (!client || !settings.bucket) return null;
		const configuredTtl = Number.isFinite(settings.signedUrlTtlSeconds) ? Math.floor(settings.signedUrlTtlSeconds) : 900;
		const expiresIn = Math.min(Math.max(configuredTtl, 1), 604800);
		const prefix = settings.mapPrefix.replace(/^\/+|\/+$/g, "");
		const keyWithoutLeadingSlashes = key.replace(/^\/+/, "");
		const objectKey = prefix ? `${prefix}/${keyWithoutLeadingSlashes}` : keyWithoutLeadingSlashes;
		return getSignedUrl(client, new GetObjectCommand({
			Bucket: settings.bucket,
			Key: objectKey
		}), { expiresIn });
	};
};
const getSignedSpacesObjectUrl = createSpacesObjectUrlSigner(config.spaces);

//#endregion
//#region src/services/postcode-data.service.ts
const getPostcodeFilter = (code) => ({ postcode: code });
const getLatestData = async (table, filters) => {
	return await findAllData(table, 10, 0, filters);
};
const getLsoaDemographicsForPostcode = async (code) => {
	const [postcodeCandidate, alternateCandidate] = getPostcodeLookupCandidates(code);
	return await prisma.$queryRaw`
    SELECT allocation.allocation_weight AS "allocationWeight", demographics.*
    FROM postcode_lsoa_allocations AS allocation
    JOIN lsoa_demographics AS demographics ON demographics.lsoa21cd = allocation.lsoa_code
    WHERE allocation.postcode = ${postcodeCandidate}
      OR allocation.postcode = ${alternateCandidate ?? postcodeCandidate}
  `;
};
const getLsoaTransportForPostcode = async (code) => {
	const [postcodeCandidate, alternateCandidate] = getPostcodeLookupCandidates(code);
	const lsoaCode = (await prisma.$queryRaw`
    SELECT allocation.lsoa_code AS "lsoaCode"
    FROM postcode_lsoa_allocations AS allocation
    WHERE (allocation.postcode = ${postcodeCandidate}
      OR allocation.postcode = ${alternateCandidate ?? postcodeCandidate})
      AND allocation.is_primary = TRUE
    LIMIT 1
  `)[0]?.lsoaCode;
	if (!lsoaCode) return null;
	const [busRoutes, stations] = await Promise.all([prisma.$queryRaw`
      SELECT
        route.rank,
        route.route_short_name AS "routeShortName",
        route.destination_label AS "destinationLabel",
        route.agency_name AS "agencyName",
        route.is_night AS "isNight",
        route.trips_in_area AS "tripsInArea",
        route.nearest_stop_name AS "nearestStopName",
        route.nearest_stop_m AS "nearestStopM"
      FROM gold_lsoa_nearby_buses AS route
      WHERE route.lsoa_code = ${lsoaCode}
      ORDER BY route.rank
    `, prisma.$queryRaw`
      SELECT
        station.station_name AS name,
        station.distance_m AS "distanceM",
        station.walk_minutes_est AS "walkMinutesEstimate"
      FROM gold_lsoa_nearby_station AS station
      WHERE station.lsoa_code = ${lsoaCode}
      LIMIT 1
    `]);
	return {
		lsoaCode,
		busRoutes,
		nearestStation: stations[0] ?? null
	};
};
const getLsoaMapForPostcode = async (code) => {
	const [postcodeCandidate, alternateCandidate] = getPostcodeLookupCandidates(code);
	const map = (await prisma.$queryRaw`
    SELECT
      bounds.filename,
      bounds.map_version AS "mapVersion",
      bounds.image_width_px AS "imageWidthPx",
      bounds.image_height_px AS "imageHeightPx",
      bounds.min_lon AS "minLon",
      bounds.max_lon AS "maxLon",
      bounds.min_lat AS "minLat",
      bounds.max_lat AS "maxLat"
    FROM postcode_lsoa_allocations AS allocation
    JOIN lsoa_map_bounds AS bounds ON bounds.lsoa_code = allocation.lsoa_code
    WHERE (allocation.postcode = ${postcodeCandidate}
      OR allocation.postcode = ${alternateCandidate ?? postcodeCandidate})
      AND allocation.is_primary = TRUE
    ORDER BY bounds.map_version DESC
    LIMIT 1
  `)[0];
	if (!map) return null;
	return {
		...map,
		imageUrl: await getSignedSpacesObjectUrl(map.filename)
	};
};
const getLatestBoroughDataset$1 = async (table, boroughName) => {
	const sql = table === "district_table" ? `SELECT district_code, borough_name FROM "district_table" WHERE borough_name = $1 ORDER BY "_built_at" DESC LIMIT 10` : table === "rent_quarterly" || table === "housing_price_quarterly" ? `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY year DESC, quarter DESC LIMIT 40` : table === "housing_stock_annual" ? `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY year DESC LIMIT 10` : `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY ${table === "district_table" ? "_built_at" : table === "housing_price_quarterly" || table === "housing_stock_annual" ? "_gold_built_at" : table === "rent_quarterly" ? "_transformed_at" : "year"} DESC LIMIT 10`;
	return await prisma.$queryRawUnsafe(sql, boroughName);
};
const buildRentData = (rows) => {
	const latest = rows[0];
	if (!latest) return [];
	return [
		{
			rent: Number(latest.rent_all ?? 0),
			type: "average"
		},
		{
			rent: Number(latest.rent_one_bed ?? 0),
			type: "1-bed"
		},
		{
			rent: Number(latest.rent_two_bed ?? 0),
			type: "2-bed"
		},
		{
			rent: Number(latest.rent_three_bed ?? 0),
			type: "3-bed"
		},
		{
			rent: Number(latest.rent_four_plus_bed ?? 0),
			type: "4+-bed"
		}
	].filter((item) => item.rent > 0);
};
const buildCrimeData = (row = {}) => {
	return [
		[
			"Total crimes per 1,000",
			row.total_crimes_per_1000,
			row.lon_avg_total_crimes_per_1000
		],
		[
			"Anti-social behaviour",
			row.anti_social_behaviour_per_1000,
			row.lon_avg_anti_social_behaviour_per_1000
		],
		[
			"Bicycle theft",
			row.bicycle_theft_per_1000,
			row.lon_avg_bicycle_theft_per_1000
		],
		[
			"Burglary",
			row.burglary_per_1000,
			row.lon_avg_burglary_per_1000
		],
		[
			"Criminal damage and arson",
			row.criminal_damage_arson_per_1000,
			row.lon_avg_criminal_damage_arson_per_1000
		],
		[
			"Drugs",
			row.drugs_per_1000,
			row.lon_avg_drugs_per_1000
		],
		[
			"Other crime",
			row.other_crime_per_1000,
			row.lon_avg_other_crime_per_1000
		],
		[
			"Other theft",
			row.other_theft_per_1000,
			row.lon_avg_other_theft_per_1000
		],
		[
			"Possession of weapons",
			row.possession_of_weapons_per_1000,
			row.lon_avg_possession_of_weapons_per_1000
		],
		[
			"Public order",
			row.public_order_per_1000,
			row.lon_avg_public_order_per_1000
		],
		[
			"Robbery",
			row.robbery_per_1000,
			row.lon_avg_robbery_per_1000
		],
		[
			"Shoplifting",
			row.shoplifting_per_1000,
			row.lon_avg_shoplifting_per_1000
		],
		[
			"Theft from the person",
			row.theft_from_the_person_per_1000,
			row.lon_avg_theft_from_the_person_per_1000
		],
		[
			"Vehicle crime",
			row.vehicle_crime_per_1000,
			row.lon_avg_vehicle_crime_per_1000
		],
		[
			"Violent crime",
			row.violent_crime_per_1000,
			row.lon_avg_violent_crime_per_1000
		]
	].filter(([, value]) => value !== null && value !== void 0).map(([label, value, comparisonValue]) => ({
		label: String(label),
		value: Number(value),
		crime_rate: Number(value),
		...comparisonValue === null || comparisonValue === void 0 ? {} : { comparisonValue: Number(comparisonValue) }
	}));
};
const buildCrimeTrendData = (rows) => rows.flatMap((row) => {
	if (row.year == null || row.total_crimes_per_1000 == null) return [];
	const year = Number(row.year);
	const totalCrimesPer1000 = Number(row.total_crimes_per_1000);
	const averageValue = row.lon_avg_total_crimes_per_1000;
	return Number.isFinite(year) && Number.isFinite(totalCrimesPer1000) ? [{
		year,
		totalCrimesPer1000,
		londonAveragePer1000: averageValue !== null && averageValue !== void 0 && Number.isFinite(Number(averageValue)) ? Number(averageValue) : null
	}] : [];
}).sort((first, second) => first.year - second.year);
const buildCrimeHighlight = (row = {}) => {
	const categories = [
		[
			"Anti-social behaviour",
			"anti_social_behaviour_per_1000",
			"pct_diff_anti_social_behaviour_per_1000",
			"yoy_pct_change_anti_social_behaviour_per_1000"
		],
		[
			"Bicycle theft",
			"bicycle_theft_per_1000",
			"pct_diff_bicycle_theft_per_1000",
			"yoy_pct_change_bicycle_theft_per_1000"
		],
		[
			"Burglary",
			"burglary_per_1000",
			"pct_diff_burglary_per_1000",
			"yoy_pct_change_burglary_per_1000"
		],
		[
			"Criminal damage and arson",
			"criminal_damage_arson_per_1000",
			"pct_diff_criminal_damage_arson_per_1000",
			"yoy_pct_change_criminal_damage_arson_per_1000"
		],
		[
			"Drugs",
			"drugs_per_1000",
			"pct_diff_drugs_per_1000",
			"yoy_pct_change_drugs_per_1000"
		],
		[
			"Other crime",
			"other_crime_per_1000",
			"pct_diff_other_crime_per_1000",
			"yoy_pct_change_other_crime_per_1000"
		],
		[
			"Other theft",
			"other_theft_per_1000",
			"pct_diff_other_theft_per_1000",
			"yoy_pct_change_other_theft_per_1000"
		],
		[
			"Possession of weapons",
			"possession_of_weapons_per_1000",
			"pct_diff_possession_of_weapons_per_1000",
			"yoy_pct_change_possession_of_weapons_per_1000"
		],
		[
			"Public order",
			"public_order_per_1000",
			"pct_diff_public_order_per_1000",
			"yoy_pct_change_public_order_per_1000"
		],
		[
			"Robbery",
			"robbery_per_1000",
			"pct_diff_robbery_per_1000",
			"yoy_pct_change_robbery_per_1000"
		],
		[
			"Shoplifting",
			"shoplifting_per_1000",
			"pct_diff_shoplifting_per_1000",
			"yoy_pct_change_shoplifting_per_1000"
		],
		[
			"Theft from the person",
			"theft_from_the_person_per_1000",
			"pct_diff_theft_from_the_person_per_1000",
			"yoy_pct_change_theft_from_the_person_per_1000"
		],
		[
			"Vehicle crime",
			"vehicle_crime_per_1000",
			"pct_diff_vehicle_crime_per_1000",
			"yoy_pct_change_vehicle_crime_per_1000"
		],
		[
			"Violent crime",
			"violent_crime_per_1000",
			"pct_diff_violent_crime_per_1000",
			"yoy_pct_change_violent_crime_per_1000"
		]
	];
	const gaps = categories.flatMap(([label, , gapField]) => {
		if (row[gapField] == null) return [];
		const value = Number(row[gapField]);
		return Number.isFinite(value) ? [{
			label,
			value
		}] : [];
	});
	const changes = categories.flatMap(([label, , , changeField]) => {
		if (row[changeField] == null) return [];
		const value = Number(row[changeField]);
		return Number.isFinite(value) ? [{
			label,
			value
		}] : [];
	});
	const lowestGap = gaps.sort((first, second) => first.value - second.value)[0];
	const largestIncrease = changes.sort((first, second) => second.value - first.value)[0];
	const totalCrimesPer1000 = row.total_crimes_per_1000 == null ? NaN : Number(row.total_crimes_per_1000);
	if (!Number.isFinite(totalCrimesPer1000)) return null;
	return {
		year: Number(row.year),
		totalCrimesPer1000,
		rank: Number.isFinite(Number(row.safety_rank_total_crimes_per_1000)) ? Number(row.safety_rank_total_crimes_per_1000) : null,
		yoyChangePct: Number.isFinite(Number(row.yoy_pct_change_total_crimes_per_1000)) ? Number(row.yoy_pct_change_total_crimes_per_1000) : null,
		lowestGapCategory: lowestGap?.label ?? null,
		lowestGapPct: lowestGap?.value ?? null,
		largestIncreaseCategory: largestIncrease?.label ?? null,
		largestIncreasePct: largestIncrease?.value ?? null
	};
};
const buildPropertyValueData = (rows) => {
	return rows.flatMap((row) => {
		const value = Number(row.value ?? row.avg_price ?? 0);
		const periodLabel = String(row.quarter_label ?? row.date ?? row.year ?? "");
		const propertyValueData = value ? [{
			label: periodLabel || "Average price",
			value
		}] : [];
		const growth = Number(row.yoy_growth_pct ?? row.yoy_growth ?? NaN);
		if (Number.isFinite(growth)) propertyValueData.push({
			label: periodLabel ? `YoY growth · ${periodLabel}` : "YoY growth",
			value: growth
		});
		return propertyValueData;
	});
};
const buildDemographyData = (rows) => {
	return rows.map((row) => ({
		age_group: String(row.age_group ?? row.label ?? "Unknown"),
		percentage: Number(row.percentage ?? 0)
	}));
};
const buildWeightedLsoaDemographyData = (rows) => {
	const ageGroups = [
		{
			label: "0-9",
			ages: Array.from({ length: 10 }, (_, index) => index)
		},
		{
			label: "10-19",
			ages: Array.from({ length: 10 }, (_, index) => index + 10)
		},
		{
			label: "20-29",
			ages: Array.from({ length: 10 }, (_, index) => index + 20)
		},
		{
			label: "30-39",
			ages: Array.from({ length: 10 }, (_, index) => index + 30)
		},
		{
			label: "40-49",
			ages: Array.from({ length: 10 }, (_, index) => index + 40)
		},
		{
			label: "50-59",
			ages: Array.from({ length: 10 }, (_, index) => index + 50)
		},
		{
			label: "60+",
			ages: Array.from({ length: 30 }, (_, index) => index + 60)
		}
	];
	const getWeight = (row) => {
		const weight = Number(row.allocationWeight ?? row.allocation_weight ?? 1);
		return Number.isFinite(weight) && weight > 0 ? weight : 0;
	};
	const weightedPopulation = rows.reduce((total, row) => {
		const population = Number(row.total ?? 0);
		return total + (Number.isFinite(population) && population > 0 ? population * getWeight(row) : 0);
	}, 0);
	if (weightedPopulation <= 0) return [];
	const getWeightedCount = (ages, gender) => rows.reduce((total, row) => {
		const weight = getWeight(row);
		if (weight === 0) return total;
		const ageCount = ages.reduce((subtotal, age) => subtotal + Number(row[`${gender}${age}`] ?? 0), 0) + (ages.includes(60) ? Number(row[`${gender}90+`] ?? 0) : 0);
		return total + (Number.isFinite(ageCount) ? ageCount * weight : 0);
	}, 0);
	return ageGroups.map(({ label, ages }) => {
		const femaleCount = getWeightedCount(ages, "F");
		const maleCount = getWeightedCount(ages, "M");
		return {
			age_group: label,
			female_percentage: Number((femaleCount / weightedPopulation * 100).toFixed(1)),
			male_percentage: Number((maleCount / weightedPopulation * 100).toFixed(1)),
			percentage: Number(((femaleCount + maleCount) / weightedPopulation * 100).toFixed(1)),
			period: rows.find((row) => row.year_name)?.year_name ?? null
		};
	});
};
const buildEducationData = (rows) => {
	const latest = rows[0];
	if (!latest) return [];
	return [
		["Independent schools", latest.independent_school_count],
		["Publicly funded nurseries", latest.public_funded_nursery],
		["Publicly funded primary schools", latest.public_funded_primary],
		["Publicly funded secondary schools", latest.public_funded_secondary],
		["Publicly funded schools", latest.public_funded_school_count],
		["Total schools", latest.total_school_count],
		["GCSE attainment 8", latest.gcse_attainment_8],
		["Strong pass English and maths", latest.strong_pass_eng_maths],
		["KS2 expected standard", latest.ks2_expectedstandard_read_write_maths],
		["KS2 higher standard", latest.ks2_higherstandard_read_write_maths],
		["Ofsted good or outstanding", latest.ofsted_goodand_outstanding],
		["Ofsted London average", latest.ofsted_london_average],
		["Education rank", latest.education_rank]
	].filter(([, value]) => value !== null && value !== void 0).map(([label, value]) => ({
		label: String(label),
		value: Number(value)
	}));
};
const buildHousingStockData = (rows) => {
	const latest = rows[0];
	if (!latest) return [];
	return [
		{
			label: "Total dwellings",
			value: Number(latest.total_dwellings ?? 0)
		},
		{
			label: "Net additions",
			value: Number(latest.net_additions ?? 0)
		},
		{
			label: "Affordable starts",
			value: Number(latest.affordable_starts ?? 0)
		},
		{
			label: "Affordable completions",
			value: Number(latest.affordable_completions ?? 0)
		},
		{
			label: "Band D",
			value: Number(latest.band_d ?? 0)
		}
	];
};
const buildDistrictData = (rows) => {
	const latest = rows[0];
	if (!latest) return [];
	return [{
		districtCode: String(latest.district_code ?? ""),
		boroughName: String(latest.borough_name ?? "")
	}];
};
const getPostcodeDataByCode$1 = async (code) => {
	const normalizedCode = normalizePostcodeCode(code);
	const postcode = await findPostcodeByCode(normalizedCode);
	if (!postcode) throw new EntityNotFoundError({
		message: `Postcode with code ${code} not found`,
		code: "ENTITY_NOT_FOUND",
		data: {
			attemptedCode: normalizedCode,
			note: "No postcode record matched the requested code."
		}
	});
	const borough = postcode.boroughId ? await findBoroughById(postcode.boroughId) : null;
	const boroughName = borough?.name;
	const [demography, lsoaDemography, propertyValueData, rentData, crimeData, votingData, rentQuarterlyRows, housingPriceRows, policeRows, educationRows, housingStockRows, districtRows, lsoaMap, transport] = await Promise.all([
		getLatestData("demography", getPostcodeFilter(normalizedCode)),
		getLsoaDemographicsForPostcode(normalizedCode),
		getLatestData("property_value_data", getPostcodeFilter(normalizedCode)),
		getLatestData("rent_data", getPostcodeFilter(normalizedCode)),
		boroughName ? getLatestData("crime_data", { borough: boroughName }) : Promise.resolve([]),
		boroughName ? getLatestData("voting_data", { borough: boroughName }) : Promise.resolve([]),
		boroughName ? getLatestBoroughDataset$1("rent_quarterly", boroughName) : Promise.resolve([]),
		boroughName ? getLatestBoroughDataset$1("housing_price_quarterly", boroughName) : Promise.resolve([]),
		boroughName ? getLatestBoroughDataset$1("police_police", boroughName) : Promise.resolve([]),
		boroughName ? getLatestBoroughDataset$1("education_london", boroughName) : Promise.resolve([]),
		boroughName ? getLatestBoroughDataset$1("housing_stock_annual", boroughName) : Promise.resolve([]),
		boroughName ? getLatestBoroughDataset$1("district_table", boroughName) : Promise.resolve([]),
		getLsoaMapForPostcode(normalizedCode),
		getLsoaTransportForPostcode(normalizedCode)
	]);
	const rentDataRows = Array.isArray(rentData) ? rentData : [];
	const propertyValueRows = Array.isArray(propertyValueData) ? propertyValueData : [];
	const crimeRows = Array.isArray(crimeData) ? crimeData : [];
	const demographyRows = Array.isArray(demography) ? demography : [];
	const lsoaDemographyRows = Array.isArray(lsoaDemography) ? lsoaDemography : [];
	const rentQuarterlyRowsTyped = Array.isArray(rentQuarterlyRows) ? rentQuarterlyRows : [];
	const housingPriceRowsTyped = Array.isArray(housingPriceRows) ? housingPriceRows : [];
	const policeRowsTyped = Array.isArray(policeRows) ? policeRows : [];
	const educationRowsTyped = Array.isArray(educationRows) ? educationRows : [];
	const housingStockRowsTyped = Array.isArray(housingStockRows) ? housingStockRows : [];
	const districtRowsTyped = Array.isArray(districtRows) ? districtRows : [];
	const housingStockTrendData = housingStockRowsTyped.map((row) => ({
		year: Number(row.year),
		totalDwellings: Number(row.total_dwellings),
		netAdditions: Number(row.net_additions)
	})).filter((row, index, rows) => Number.isFinite(row.year) && Number.isFinite(row.totalDwellings) && Number.isFinite(row.netAdditions) && rows.findIndex((candidate) => candidate.year === row.year) === index).sort((first, second) => second.year - first.year).slice(0, 2);
	const mappedRentData = rentDataRows.length > 0 ? rentDataRows.map((row) => ({
		rent: Number(row.rent ?? 0),
		type: String(row.property_type ?? "average")
	})) : buildRentData(rentQuarterlyRowsTyped);
	const mappedPropertyValueData = propertyValueRows.length > 0 ? propertyValueRows.map((row) => ({
		label: String(row.date ?? row.year ?? "Latest value"),
		value: Number(row.value ?? 0)
	})) : buildPropertyValueData(housingPriceRowsTyped);
	const mappedCrimeData = crimeRows.length > 0 ? crimeRows.map((row) => ({
		label: String(row.crime_type ?? "Crime"),
		crime_rate: Number(row.crime_rate ?? 0),
		value: Number(row.crime_rate ?? 0)
	})) : buildCrimeData(policeRowsTyped[0] ?? {});
	const mappedDemography = lsoaDemographyRows.length > 0 ? buildWeightedLsoaDemographyData(lsoaDemographyRows) : demographyRows.length > 0 ? demographyRows.map((row) => ({
		age_group: String(row.age_group ?? "Unknown"),
		percentage: Number(row.percentage ?? 0)
	})) : buildDemographyData(demographyRows);
	const weightedDemographyPopulation = lsoaDemographyRows.reduce((total, row) => {
		const population = Number(row.total ?? 0);
		const allocationWeight = Number(row.allocationWeight ?? row.allocation_weight ?? 1);
		return Number.isFinite(population) && population > 0 && Number.isFinite(allocationWeight) && allocationWeight > 0 ? total + population * allocationWeight : total;
	}, 0);
	const latestPoliceRow = policeRowsTyped[0];
	return {
		postcode,
		lsoaMap,
		transport,
		crimeRateContext: latestPoliceRow ? {
			boroughName: String(latestPoliceRow.borough_name ?? boroughName ?? "Borough"),
			year: Number(latestPoliceRow.year),
			population: Number(latestPoliceRow.population),
			annualisedCrimes: Number(latestPoliceRow.total_crimes_annualised),
			ratePer1000: Number(latestPoliceRow.total_crimes_per_1000),
			londonAveragePer1000: Number(latestPoliceRow.lon_avg_total_crimes_per_1000)
		} : null,
		borough: borough ?? null,
		crimeData: mappedCrimeData,
		demography: mappedDemography,
		demographyPopulation: weightedDemographyPopulation > 0 ? Math.round(weightedDemographyPopulation) : null,
		propertyValueData: mappedPropertyValueData,
		priceTrendData: housingPriceRowsTyped.map((row) => ({
			year: Number(row.year),
			quarter: Number(row.quarter),
			value: Number(row.avg_price ?? 0)
		})).filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value) && row.value > 0).reverse(),
		rentData: mappedRentData,
		rentTrendData: rentQuarterlyRowsTyped.map((row) => ({
			year: Number(row.year),
			quarter: Number(row.quarter),
			value: Number(row.rent_all ?? 0)
		})).filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value) && row.value > 0).reverse(),
		votingData,
		educationData: buildEducationData(educationRowsTyped),
		housingStockData: buildHousingStockData(housingStockRowsTyped),
		housingStockTrendData,
		districtData: buildDistrictData(districtRowsTyped)
	};
};

//#endregion
//#region src/services/borough.service.ts
const getAllBoroughs$1 = async (page, limit) => {
	const { offset } = paginate(page, limit);
	const [boroughs, total] = await Promise.all([findAllBoroughs(limit, offset), countBoroughs()]);
	return buildPaginatedResult(boroughs, total, page, limit);
};
const normalizeBoroughName = (boroughName) => {
	const normalizedName = boroughName.trim().toLowerCase();
	if (normalizedName === "city of westminster") return "Westminster";
	if (normalizedName === "barking & dagenham") return "Barking and Dagenham";
	return boroughName;
};
const mapHousingStockRow = (row, boroughName) => ({
	boroughName: normalizeBoroughName(String(row.borough_name ?? boroughName)),
	year: Number(row.year ?? 0),
	totalDwellings: Number(row.total_dwellings ?? 0),
	netAdditions: Number(row.net_additions ?? 0),
	affordableStarts: Number(row.affordable_starts ?? 0),
	affordableCompletions: Number(row.affordable_completions ?? 0),
	bandD: Number(row.band_d ?? 0),
	bandDRank: row.rank_band_d_lowest == null ? null : Number(row.rank_band_d_lowest),
	affordableFinancialYear: row.affordable_financial_year == null ? null : String(row.affordable_financial_year),
	totalDwellingsRank: row.rank_total_dwellings == null ? null : Number(row.rank_total_dwellings),
	netAdditionsRank: row.rank_net_additions == null ? null : Number(row.rank_net_additions)
});
const getBoroughComparisonData = async (boroughName) => {
	const [priceRows, priceHistoryRows, housingRows, educationRows, policeRows] = await Promise.all([
		prisma.$queryRaw`
      SELECT DISTINCT ON (borough_name)
        borough_name, avg_price, yoy_growth_pct, quarter_label
      FROM housing_price_quarterly
      WHERE lower(borough_name) <> 'london'
      ORDER BY borough_name, year DESC, quarter DESC
    `,
		prisma.$queryRaw`
      SELECT borough_name, yoy_growth_pct, quarter_label
      FROM (
        SELECT borough_name, yoy_growth_pct, quarter_label, year, quarter,
          ROW_NUMBER() OVER (PARTITION BY borough_name ORDER BY year DESC, quarter DESC) AS period_rank
        FROM housing_price_quarterly
        WHERE lower(borough_name) <> 'london'
      ) ranked_prices
      WHERE period_rank <= 40
      ORDER BY borough_name, year, quarter
    `,
		prisma.$queryRaw`
      SELECT DISTINCT ON (borough_name)
        borough_name, year, total_dwellings, net_additions,
        affordable_starts, affordable_completions, affordable_financial_year, band_d,
        rank_total_dwellings, rank_net_additions, rank_band_d_lowest
      FROM housing_stock_annual
      WHERE lower(borough_name) <> 'london'
      ORDER BY borough_name, year DESC
    `,
		prisma.$queryRaw`
      SELECT DISTINCT ON (borough_name)
        borough_name, total_school_count, education_rank, gcse_attainment_8,
        ks2_expectedstandard_read_write_maths, ofsted_goodand_outstanding
      FROM education_london
      WHERE lower(borough_name) <> 'london'
      ORDER BY borough_name, year DESC
    `,
		prisma.$queryRaw`
      SELECT DISTINCT ON (borough_name, year)
        borough_name, year, total_crimes_per_1000, total_crimes_annualised,
        safety_rank_total_crimes_per_1000
      FROM police_police
      WHERE lower(borough_name) <> 'london'
      ORDER BY borough_name, year DESC
    `
	]);
	const priceGrowthHistoryByBorough = /* @__PURE__ */ new Map();
	for (const row of priceHistoryRows) {
		if (row.yoy_growth_pct == null) continue;
		const value = Number(row.yoy_growth_pct);
		if (!Number.isFinite(value)) continue;
		const normalizedName = normalizeBoroughName(String(row.borough_name));
		const history = priceGrowthHistoryByBorough.get(normalizedName) ?? [];
		history.push({
			period: String(row.quarter_label ?? ""),
			value
		});
		priceGrowthHistoryByBorough.set(normalizedName, history);
	}
	return {
		housingPriceComparisonData: priceRows.map((row) => ({
			boroughName: normalizeBoroughName(String(row.borough_name)),
			averagePrice: Number(row.avg_price ?? 0),
			yoyGrowthPct: Number(row.yoy_growth_pct ?? 0),
			period: String(row.quarter_label ?? ""),
			growthHistory: priceGrowthHistoryByBorough.get(normalizeBoroughName(String(row.borough_name))) ?? []
		})),
		housingStockComparisonData: housingRows.map((row) => mapHousingStockRow(row, boroughName)),
		educationComparisonData: educationRows.map((row) => ({
			boroughName: normalizeBoroughName(String(row.borough_name)),
			totalSchools: Number(row.total_school_count ?? 0),
			educationRank: Number(row.education_rank ?? 0),
			gcseAttainment8: Number(row.gcse_attainment_8 ?? 0),
			ks2ExpectedStandard: Number(row.ks2_expectedstandard_read_write_maths ?? 0),
			ofstedGoodAndOutstanding: Number(row.ofsted_goodand_outstanding ?? 0)
		})),
		policingComparisonData: policeRows.map((row) => ({
			boroughName: normalizeBoroughName(String(row.borough_name)),
			year: Number(row.year ?? 0),
			totalCrimesPer1000: Number(row.total_crimes_per_1000 ?? 0),
			totalCrimesAnnualised: row.total_crimes_annualised == null ? null : Number(row.total_crimes_annualised),
			safetyRank: row.safety_rank_total_crimes_per_1000 == null ? null : Number(row.safety_rank_total_crimes_per_1000)
		}))
	};
};
const getLatestBoroughDataset = async (table, boroughName) => {
	const orderByField = table === "district_table" ? "_built_at" : table === "housing_price_quarterly" || table === "housing_stock_annual" ? "_gold_built_at" : table === "rent_quarterly" ? "_transformed_at" : "year";
	const sql = table === "district_table" ? `SELECT district_code, borough_name FROM "district_table" WHERE borough_name = $1 ORDER BY "_built_at" DESC LIMIT 10` : table === "rent_quarterly" || table === "housing_price_quarterly" ? `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY year DESC, quarter DESC LIMIT 40` : table === "housing_stock_annual" ? `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY year DESC LIMIT 10` : table === "police_police" ? `SELECT * FROM "${table}" WHERE lower(replace(borough_name, '&', 'and')) = lower(replace($1, '&', 'and')) ORDER BY ${orderByField} DESC LIMIT 10` : `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY ${orderByField} DESC LIMIT 10`;
	return await prisma.$queryRawUnsafe(sql, boroughName);
};
const getBoroughById$1 = async (id) => {
	const borough = await findBoroughById(id);
	if (!borough) throw new EntityNotFoundError({
		message: `Borough with ID ${id} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	const boroughName = borough.name;
	const [rentQuarterlyRows, housingPriceRows, policeRows, educationRows, housingStockRows, districtRows, comparisonData] = boroughName ? await Promise.all([
		getLatestBoroughDataset("rent_quarterly", boroughName),
		getLatestBoroughDataset("housing_price_quarterly", boroughName),
		getLatestBoroughDataset("police_police", boroughName),
		getLatestBoroughDataset("education_london", boroughName),
		getLatestBoroughDataset("housing_stock_annual", boroughName),
		getLatestBoroughDataset("district_table", boroughName),
		getBoroughComparisonData(boroughName)
	]) : [
		[],
		[],
		[],
		[],
		[],
		[],
		{
			housingPriceComparisonData: [],
			housingStockComparisonData: [],
			educationComparisonData: [],
			policingComparisonData: []
		}
	];
	const rentQuarterlyRowsTyped = Array.isArray(rentQuarterlyRows) ? rentQuarterlyRows : [];
	const housingPriceRowsTyped = Array.isArray(housingPriceRows) ? housingPriceRows : [];
	const policeRowsTyped = Array.isArray(policeRows) ? policeRows : [];
	const educationRowsTyped = Array.isArray(educationRows) ? educationRows : [];
	const housingStockRowsTyped = Array.isArray(housingStockRows) ? housingStockRows : [];
	const districtRowsTyped = Array.isArray(districtRows) ? districtRows : [];
	return {
		...borough,
		educationData: buildEducationData(educationRowsTyped),
		housingStockData: buildHousingStockData(housingStockRowsTyped),
		districtData: buildDistrictData(districtRowsTyped),
		rentData: buildRentData(rentQuarterlyRowsTyped),
		rentTrendData: rentQuarterlyRowsTyped.map((row) => ({
			year: Number(row.year),
			quarter: Number(row.quarter),
			value: Number(row.rent_all ?? 0)
		})).filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value) && row.value > 0).reverse(),
		propertyValueData: buildPropertyValueData(housingPriceRowsTyped),
		priceTrendData: housingPriceRowsTyped.map((row) => ({
			year: Number(row.year),
			quarter: Number(row.quarter),
			value: Number(row.avg_price ?? 0)
		})).filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value) && row.value > 0).reverse(),
		crimeData: buildCrimeData(policeRowsTyped[0] ?? {}),
		crimeTrendData: buildCrimeTrendData(policeRowsTyped),
		crimeHighlight: buildCrimeHighlight(policeRowsTyped[0] ?? {}),
		housingPriceComparisonData: comparisonData.housingPriceComparisonData,
		housingStockComparisonData: comparisonData.housingStockComparisonData,
		housingStockHistory: housingStockRowsTyped.map((row) => mapHousingStockRow(row, boroughName)),
		educationComparisonData: comparisonData.educationComparisonData,
		policingComparisonData: comparisonData.policingComparisonData
	};
};
const getBoroughBySlug$1 = async (slug) => {
	const borough = await findBoroughBySlug(slug);
	if (!borough) throw new EntityNotFoundError({
		message: `Borough with slug ${slug} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	return borough;
};
const createNewBorough = async (data) => {
	if (await findBoroughBySlug(data.slug)) throw new ValidationError({
		message: `Borough with slug ${data.slug} already exists`,
		code: "VALIDATION_ERROR"
	});
	return await createBorough$1({
		name: data.name,
		slug: data.slug,
		description: data.description,
		image: data.image,
		latitude: data.latitude,
		longitude: data.longitude,
		metrics: data.metrics || {}
	});
};
const updateBoroughById = async (id, data) => {
	await getBoroughById$1(id);
	if (data.slug) {
		const existingSlug = await findBoroughBySlug(data.slug);
		if (existingSlug && existingSlug.boroughId !== id) throw new ValidationError({
			message: `Borough with slug ${data.slug} already exists`,
			code: "VALIDATION_ERROR"
		});
	}
	return await updateBorough$1(id, {
		name: data.name,
		slug: data.slug,
		description: data.description,
		image: data.image,
		latitude: data.latitude,
		longitude: data.longitude,
		metrics: data.metrics
	});
};
const deleteBoroughById = async (id) => {
	await getBoroughById$1(id);
	return await deleteBorough$1(id);
};

//#endregion
//#region src/controllers/borough.controller.ts
const getAllBoroughs = async (req, res) => {
	const page = Number(req.query.page) || 1;
	const limit = Number(req.query.limit) || 10;
	const { data, pagination } = await getAllBoroughs$1(page, limit);
	const response = {
		success: true,
		statusCode: 200,
		data,
		pagination,
		message: "Boroughs fetched successfully"
	};
	res.status(200).json(response);
};
const getBoroughById = async (req, res) => {
	const id = String(req.params.id);
	const response = {
		success: true,
		statusCode: 200,
		data: await getBoroughById$1(id),
		message: "Borough fetched successfully"
	};
	res.status(200).json(response);
};
const getBoroughBySlug = async (req, res) => {
	const slug = String(req.params.slug);
	const response = {
		success: true,
		statusCode: 200,
		data: await getBoroughBySlug$1(slug),
		message: "Borough fetched successfully by slug"
	};
	res.status(200).json(response);
};
const createBorough = async (req, res) => {
	const response = {
		success: true,
		statusCode: 201,
		data: await createNewBorough(req.body),
		message: "Borough created successfully"
	};
	res.status(201).json(response);
};
const updateBorough = async (req, res) => {
	const id = String(req.params.id);
	const response = {
		success: true,
		statusCode: 200,
		data: await updateBoroughById(id, req.body),
		message: "Borough updated successfully"
	};
	res.status(200).json(response);
};
const deleteBorough = async (req, res) => {
	const id = String(req.params.id);
	await deleteBoroughById(id);
	res.status(200).json({
		success: true,
		statusCode: 200,
		message: "Borough deleted successfully"
	});
};

//#endregion
//#region src/dto/pagination.dto.ts
const PaginationQueryDto = object({
	page: preprocess((val) => val ? Number(val) : void 0, number().int().min(1).default(1)),
	limit: preprocess((val) => val ? Number(val) : void 0, number().int().min(1).max(100).default(10))
}).passthrough();
const OptionalPaginationQueryDto = object({
	page: preprocess((val) => val ? Number(val) : void 0, number().int().min(1).optional()),
	limit: preprocess((val) => val ? Number(val) : void 0, number().int().min(1).max(100).optional())
}).passthrough();

//#endregion
//#region src/dto/borough.dto.ts
const CreateBoroughDto = object({
	name: string().min(1),
	slug: string().min(1),
	description: string().optional(),
	image: string().optional(),
	latitude: number().optional(),
	longitude: number().optional(),
	metrics: record(string(), any()).optional()
});
const UpdateBoroughDto = object({
	name: string().min(1).optional(),
	slug: string().min(1).optional(),
	description: string().optional(),
	image: string().optional(),
	latitude: number().optional(),
	longitude: number().optional(),
	metrics: record(string(), any()).optional()
});

//#endregion
//#region src/routes/borough.routes.ts
const router$26 = Router();
router$26.get("/", validateRequest({ query: PaginationQueryDto }), getAllBoroughs);
router$26.get("/:id", getBoroughById);
router$26.get("/slug/:slug", getBoroughBySlug);
router$26.post("/", authenticate, authorize("manage:locations"), validateRequest({ body: CreateBoroughDto }), createBorough);
router$26.put("/:id", authenticate, authorize("manage:locations"), validateRequest({ body: UpdateBoroughDto }), updateBorough);
router$26.delete("/:id", authenticate, authorize("manage:locations"), deleteBorough);

//#endregion
//#region src/services/postcode.service.ts
const districtCodePattern = /^E\d{8}$/i;
const resolveBoroughId = async (boroughReference) => {
	if (!boroughReference) return void 0;
	if (!districtCodePattern.test(boroughReference)) return (await findBoroughById(boroughReference))?.boroughId;
	const boroughName = (await prisma.$queryRaw`
    SELECT borough_name
    FROM "district_table"
    WHERE district_code = ${boroughReference.toUpperCase()}
    ORDER BY "_built_at" DESC
    LIMIT 1
  `)[0]?.borough_name?.trim();
	if (!boroughName) return void 0;
	return (await findBoroughByName(boroughName))?.boroughId;
};
const getAllPostcodes$1 = async (page, limit, filter) => {
	const { offset } = paginate(page, limit);
	const [postcodes, total] = await Promise.all([findAllPostcodes(limit, offset, filter), countPostcodes(filter)]);
	return buildPaginatedResult(postcodes, total, page, limit);
};
const getPostcodeById$1 = async (id) => {
	const postcode = await findPostcodeById(id);
	if (!postcode) throw new EntityNotFoundError({
		message: `Postcode with ID ${id} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	return postcode;
};
const getPostcodeByCode$1 = async (code) => {
	const postcode = await findPostcodeByCode(normalizePostcodeCode(code));
	if (!postcode) throw new EntityNotFoundError({
		message: `Postcode with code ${code} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	return postcode;
};
const getPostcodeReportDataByCode$1 = async (code) => {
	return getPostcodeDataByCode$1(code);
};
const createNewPostcode = async (data) => {
	const normalizedCode = normalizePostcodeCode(data.code);
	if (await findPostcodeByCode(normalizedCode)) throw new ValidationError({
		message: `Postcode with code ${data.code} already exists`,
		code: "VALIDATION_ERROR"
	});
	const boroughId = await resolveBoroughId(data.boroughId);
	if (data.boroughId && !boroughId) throw new ValidationError({
		message: `Borough reference ${data.boroughId} does not resolve to an existing borough`,
		code: "VALIDATION_ERROR"
	});
	return await createPostcode$1({
		code: normalizedCode,
		outcode: data.outcode.toUpperCase().trim(),
		incode: data.incode.toUpperCase().trim(),
		latitude: data.latitude,
		longitude: data.longitude,
		metrics: data.metrics || {},
		...boroughId ? { borough: { connect: { boroughId } } } : {}
	});
};
const updatePostcodeById = async (id, data) => {
	await getPostcodeById$1(id);
	if (data.code) {
		const existingCode = await findPostcodeByCode(normalizePostcodeCode(data.code));
		if (existingCode && existingCode.postcodeId !== id) throw new ValidationError({
			message: `Postcode with code ${data.code} already exists`,
			code: "VALIDATION_ERROR"
		});
	}
	const boroughId = await resolveBoroughId(data.boroughId);
	if (data.boroughId && !boroughId) throw new ValidationError({
		message: `Borough reference ${data.boroughId} does not resolve to an existing borough`,
		code: "VALIDATION_ERROR"
	});
	return await updatePostcode$1(id, {
		code: data.code ? normalizePostcodeCode(data.code) : void 0,
		outcode: data.outcode ? data.outcode.toUpperCase().trim() : void 0,
		incode: data.incode ? data.incode.toUpperCase().trim() : void 0,
		latitude: data.latitude,
		longitude: data.longitude,
		metrics: data.metrics,
		...boroughId ? { borough: { connect: { boroughId } } } : {}
	});
};
const deletePostcodeById = async (id) => {
	await getPostcodeById$1(id);
	return await deletePostcode$1(id);
};

//#endregion
//#region src/controllers/postcode.controller.ts
const getAllPostcodes = async (req, res) => {
	const page = Number(req.query.page) || 1;
	const limit = Number(req.query.limit) || 10;
	const filter = {
		outcode: req.query.outcode,
		boroughId: req.query.boroughId
	};
	const { data, pagination } = await getAllPostcodes$1(page, limit, filter);
	const response = {
		success: true,
		statusCode: 200,
		data,
		pagination,
		message: "Postcodes fetched successfully"
	};
	res.status(200).json(response);
};
const getPostcodeById = async (req, res) => {
	const id = String(req.params.id);
	const response = {
		success: true,
		statusCode: 200,
		data: await getPostcodeById$1(id),
		message: "Postcode fetched successfully"
	};
	res.status(200).json(response);
};
const getPostcodeByCode = async (req, res) => {
	const code = String(req.params.code);
	const response = {
		success: true,
		statusCode: 200,
		data: await getPostcodeByCode$1(code),
		message: "Postcode fetched successfully by code"
	};
	res.status(200).json(response);
};
const getPostcodeReportDataByCode = async (req, res) => {
	const code = String(req.params.code);
	const response = {
		success: true,
		statusCode: 200,
		data: await getPostcodeReportDataByCode$1(code),
		message: "Postcode report data fetched successfully"
	};
	res.status(200).json(response);
};
const createPostcode = async (req, res) => {
	const response = {
		success: true,
		statusCode: 201,
		data: await createNewPostcode(req.body),
		message: "Postcode created successfully"
	};
	res.status(201).json(response);
};
const updatePostcode = async (req, res) => {
	const id = String(req.params.id);
	const response = {
		success: true,
		statusCode: 200,
		data: await updatePostcodeById(id, req.body),
		message: "Postcode updated successfully"
	};
	res.status(200).json(response);
};
const deletePostcode = async (req, res) => {
	const id = String(req.params.id);
	await deletePostcodeById(id);
	res.status(200).json({
		success: true,
		statusCode: 200,
		message: "Postcode deleted successfully"
	});
};

//#endregion
//#region src/dto/postcode.dto.ts
const CreatePostcodeDto = object({
	code: string().min(1),
	outcode: string().min(1),
	incode: string().min(1),
	latitude: number().optional(),
	longitude: number().optional(),
	metrics: record(string(), any()).optional(),
	boroughId: string().optional()
});
const UpdatePostcodeDto = object({
	code: string().min(1).optional(),
	outcode: string().min(1).optional(),
	incode: string().min(1).optional(),
	latitude: number().optional(),
	longitude: number().optional(),
	metrics: record(string(), any()).optional(),
	boroughId: string().optional()
});

//#endregion
//#region src/routes/postcode.routes.ts
const router$25 = Router();
router$25.get("/", validateRequest({ query: PaginationQueryDto }), getAllPostcodes);
router$25.get("/code/:code", getPostcodeByCode);
router$25.get("/code/:code/report-data", getPostcodeReportDataByCode);
router$25.get("/:id", getPostcodeById);
router$25.post("/", authenticate, authorize("manage:locations"), validateRequest({ body: CreatePostcodeDto }), createPostcode);
router$25.put("/:id", authenticate, authorize("manage:locations"), validateRequest({ body: UpdatePostcodeDto }), updatePostcode);
router$25.delete("/:id", authenticate, authorize("manage:locations"), deletePostcode);

//#endregion
//#region src/controllers/saved-property.controller.ts
const getSavedProperties = async (req, res) => {
	try {
		const userId = req.user?.userId;
		if (!userId) {
			res.status(401).json({
				success: false,
				statusCode: 401,
				error: "Authentication required"
			});
			return;
		}
		const response = {
			success: true,
			statusCode: 200,
			data: await prisma.saved_properties.findMany({
				where: { user_id: userId },
				include: { properties: true },
				orderBy: { created_at: "desc" }
			}),
			message: "Saved properties fetched successfully"
		};
		res.status(200).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to fetch saved properties";
		res.status(500).json({
			success: false,
			statusCode: 500,
			error: message
		});
	}
};
const saveProperty = async (req, res) => {
	try {
		const userId = req.user?.userId;
		const propertyId = String(req.params.propertyId ?? req.body.propertyId ?? "");
		if (!userId) {
			res.status(401).json({
				success: false,
				statusCode: 401,
				error: "Authentication required"
			});
			return;
		}
		if (!propertyId) {
			res.status(400).json({
				success: false,
				statusCode: 400,
				error: "Property ID is required"
			});
			return;
		}
		const existing = await prisma.saved_properties.findUnique({ where: { user_id_property_id: {
			user_id: userId,
			property_id: propertyId
		} } });
		if (existing) {
			const response = {
				success: true,
				statusCode: 200,
				data: existing,
				message: "Property already saved"
			};
			res.status(200).json(response);
			return;
		}
		const now = /* @__PURE__ */ new Date();
		const response = {
			success: true,
			statusCode: 201,
			data: await prisma.saved_properties.create({
				data: {
					saved_property_id: crypto.randomUUID(),
					user_id: userId,
					property_id: propertyId,
					created_at: now,
					updated_at: now
				},
				include: { properties: true }
			}),
			message: "Property saved successfully"
		};
		res.status(201).json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to save property";
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: message
		});
	}
};
const removeSavedProperty = async (req, res) => {
	try {
		const userId = req.user?.userId;
		const propertyId = String(req.params.propertyId ?? "");
		if (!userId) {
			res.status(401).json({
				success: false,
				statusCode: 401,
				error: "Authentication required"
			});
			return;
		}
		if (!await prisma.saved_properties.findUnique({ where: { user_id_property_id: {
			user_id: userId,
			property_id: propertyId
		} } })) {
			res.status(404).json({
				success: false,
				statusCode: 404,
				error: "Saved property not found"
			});
			return;
		}
		await prisma.saved_properties.delete({ where: { user_id_property_id: {
			user_id: userId,
			property_id: propertyId
		} } });
		res.status(200).json({
			success: true,
			statusCode: 200,
			data: null,
			message: "Property removed from saved list successfully"
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to remove saved property";
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: message
		});
	}
};

//#endregion
//#region src/routes/saved-property.routes.ts
const router$24 = Router();
router$24.get("/", authenticate, getSavedProperties);
router$24.post("/:propertyId", authenticate, saveProperty);
router$24.delete("/:propertyId", authenticate, removeSavedProperty);

//#endregion
//#region src/controllers/experience.controller.ts
const getAllExperiences = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Experiences fetched successfully"
	});
};
const getExperienceById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Experience fetched successfully"
	});
};
const createExperience = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Experience created successfully"
	});
};
const updateExperience = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Experience updated successfully"
	});
};
const deleteExperience = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Experience deleted successfully"
	});
};

//#endregion
//#region src/routes/experience.routes.ts
const router$23 = Router();
router$23.get("/", getAllExperiences);
router$23.get("/:id", getExperienceById);
router$23.post("/", authenticate, createExperience);
router$23.put("/:id", authenticate, updateExperience);
router$23.delete("/:id", authenticate, deleteExperience);

//#endregion
//#region src/controllers/blog-category.controller.ts
const getAllBlogCategories = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog categories fetched successfully"
	});
};
const getBlogCategoryById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog category fetched successfully"
	});
};
const createBlogCategory = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Blog category created successfully"
	});
};
const updateBlogCategory = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog category updated successfully"
	});
};
const deleteBlogCategory = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog category deleted successfully"
	});
};

//#endregion
//#region src/routes/blog-category.routes.ts
const router$22 = Router();
router$22.get("/", getAllBlogCategories);
router$22.get("/:id", getBlogCategoryById);
router$22.post("/", createBlogCategory);
router$22.put("/:id", updateBlogCategory);
router$22.delete("/:id", deleteBlogCategory);

//#endregion
//#region src/controllers/blog-tag.controller.ts
const getAllBlogTags = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog tags fetched successfully"
	});
};
const getBlogTagById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog tag fetched successfully"
	});
};
const createBlogTag = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Blog tag created successfully"
	});
};
const updateBlogTag = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog tag updated successfully"
	});
};
const deleteBlogTag = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog tag deleted successfully"
	});
};

//#endregion
//#region src/routes/blog-tag.routes.ts
const router$21 = Router();
router$21.get("/", getAllBlogTags);
router$21.get("/:id", getBlogTagById);
router$21.post("/", createBlogTag);
router$21.put("/:id", updateBlogTag);
router$21.delete("/:id", deleteBlogTag);

//#endregion
//#region src/controllers/blog-post.controller.ts
const getAllBlogPosts = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog posts fetched successfully"
	});
};
const getBlogPostById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog post fetched successfully"
	});
};
const createBlogPost = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Blog post created successfully"
	});
};
const updateBlogPost = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog post updated successfully"
	});
};
const deleteBlogPost = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Blog post deleted successfully"
	});
};

//#endregion
//#region src/routes/blog-post.routes.ts
const router$20 = Router();
router$20.get("/", getAllBlogPosts);
router$20.get("/:id", getBlogPostById);
router$20.post("/", createBlogPost);
router$20.put("/:id", updateBlogPost);
router$20.delete("/:id", deleteBlogPost);

//#endregion
//#region src/controllers/newsletter.controller.ts
const subscribe = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Subscribed successfully"
	});
};
const confirmSubscription = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Subscription confirmed successfully"
	});
};
const unsubscribe = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Unsubscribed successfully"
	});
};

//#endregion
//#region src/routes/newsletter.routes.ts
const router$19 = Router();
router$19.post("/subscribe", subscribe);
router$19.get("/confirm/:token", confirmSubscription);
router$19.post("/unsubscribe", unsubscribe);

//#endregion
//#region src/controllers/contact-inquiry.controller.ts
const getAllContactInquiries = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Contact inquiries fetched successfully"
	});
};
const getContactInquiryById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Contact inquiry fetched successfully"
	});
};
const createContactInquiry = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Contact inquiry created successfully"
	});
};
const updateContactInquiry = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Contact inquiry updated successfully"
	});
};
const deleteContactInquiry = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Contact inquiry deleted successfully"
	});
};

//#endregion
//#region src/routes/contact-inquiry.routes.ts
const router$18 = Router();
router$18.get("/", getAllContactInquiries);
router$18.get("/:id", getContactInquiryById);
router$18.post("/", createContactInquiry);
router$18.put("/:id", updateContactInquiry);
router$18.delete("/:id", deleteContactInquiry);

//#endregion
//#region src/controllers/agency.controller.ts
const getAllAgencies = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Agencies fetched successfully"
	});
};
const getAgencyById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Agency fetched successfully"
	});
};
const createAgency = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Agency created successfully"
	});
};
const updateAgency = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Agency updated successfully"
	});
};
const verifyAgency = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Agency verified successfully"
	});
};
const deleteAgency = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Agency deleted successfully"
	});
};
const getAgencyAgents = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Agency agents fetched successfully"
	});
};
const verifyAgentInAgency = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Agent verified successfully"
	});
};

//#endregion
//#region src/routes/agency.routes.ts
const router$17 = Router();
router$17.get("/", getAllAgencies);
router$17.get("/:id", getAgencyById);
router$17.post("/", authenticate, createAgency);
router$17.put("/:id", authenticate, updateAgency);
router$17.post("/:id/verify", authenticate, verifyAgency);
router$17.delete("/:id", authenticate, deleteAgency);
router$17.get("/:id/agents", authenticate, getAgencyAgents);
router$17.post("/:id/agents/:agentId/verify", authenticate, verifyAgentInAgency);

//#endregion
//#region src/controllers/user-credits.controller.ts
const getUserCredits = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "User credits fetched successfully"
	});
};
const getCreditHistory = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Credit history fetched successfully"
	});
};
const purchaseCredits = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Credits purchased successfully"
	});
};
const useCreditsForDownload = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Credits used for download successfully"
	});
};

//#endregion
//#region src/routes/user-credits.routes.ts
const router$16 = Router();
router$16.get("/", authenticate, getUserCredits);
router$16.get("/history", authenticate, getCreditHistory);
router$16.post("/purchase", authenticate, purchaseCredits);
router$16.post("/download", authenticate, useCreditsForDownload);

//#endregion
//#region src/controllers/credit-transaction.controller.ts
const getAllCreditTransactions = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "All credit transactions fetched successfully"
	});
};
const getCreditTransactionById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Credit transaction fetched successfully"
	});
};

//#endregion
//#region src/routes/credit-transaction.routes.ts
const router$15 = Router();
router$15.get("/", authenticate, getAllCreditTransactions);
router$15.get("/:id", authenticate, getCreditTransactionById);

//#endregion
//#region src/controllers/local-plan.controller.ts
const getAllLocalPlans = async (req, res) => {
	const borough = String(req.query.borough ?? "").trim();
	const response = {
		success: true,
		statusCode: 200,
		data: await prisma.local_plans.findMany({
			where: borough ? { borough: {
				equals: borough,
				mode: "insensitive"
			} } : void 0,
			orderBy: [{ borough: "asc" }, { category: "asc" }]
		}),
		message: "Local plans fetched successfully"
	};
	res.status(200).json(response);
};
const getLocalPlanById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Local plan fetched successfully"
	});
};
const createLocalPlan = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Local plan created successfully"
	});
};
const updateLocalPlan = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Local plan updated successfully"
	});
};
const deleteLocalPlan = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Local plan deleted successfully"
	});
};

//#endregion
//#region src/routes/local-plan.routes.ts
const router$14 = Router();
router$14.get("/", getAllLocalPlans);
router$14.get("/:id", getLocalPlanById);
router$14.post("/", createLocalPlan);
router$14.put("/:id", updateLocalPlan);
router$14.delete("/:id", deleteLocalPlan);

//#endregion
//#region src/controllers/download-history.controller.ts
const getDownloadHistory = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Download history fetched successfully"
	});
};
const createDownloadHistory = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Download history created successfully"
	});
};

//#endregion
//#region src/routes/download-history.routes.ts
const router$13 = Router();
router$13.get("/", authenticate, getDownloadHistory);
router$13.post("/", authenticate, createDownloadHistory);

//#endregion
//#region src/controllers/property-valuation.controller.ts
const getAllPropertyValuations = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "All property valuations fetched successfully"
	});
};
const getPropertyValuationById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Property valuation fetched successfully"
	});
};
const createPropertyValuation = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Property valuation created successfully"
	});
};

//#endregion
//#region src/routes/property-valuation.routes.ts
const router$12 = Router();
router$12.get("/", authenticate, getAllPropertyValuations);
router$12.get("/:id", authenticate, getPropertyValuationById);
router$12.post("/", authenticate, createPropertyValuation);

//#endregion
//#region src/controllers/ai-interaction.controller.ts
const getAllAIInteractions = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "All AI interactions fetched successfully"
	});
};
const getAIInteractionById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "AI interaction fetched successfully"
	});
};
const createAIInteraction = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "AI interaction created successfully"
	});
};

//#endregion
//#region src/routes/ai-interaction.routes.ts
const router$11 = Router();
router$11.get("/", authenticate, getAllAIInteractions);
router$11.get("/:id", authenticate, getAIInteractionById);
router$11.post("/", authenticate, createAIInteraction);

//#endregion
//#region src/controllers/rent-data.controller.ts
const getAllRentData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Rent data fetched successfully"
	});
};
const getRentDataById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Rent data fetched successfully"
	});
};
const createRentData = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Rent data created successfully"
	});
};
const updateRentData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Rent data updated successfully"
	});
};
const deleteRentData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Rent data deleted successfully"
	});
};

//#endregion
//#region src/routes/rent-data.routes.ts
const router$10 = Router();
router$10.get("/", getAllRentData);
router$10.get("/:id", getRentDataById);
router$10.post("/", createRentData);
router$10.put("/:id", updateRentData);
router$10.delete("/:id", deleteRentData);

//#endregion
//#region src/controllers/property-value-data.controller.ts
const getAllPropertyValueData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Property value data fetched successfully"
	});
};
const getPropertyValueDataById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Property value data fetched successfully"
	});
};
const createPropertyValueData = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Property value data created successfully"
	});
};
const updatePropertyValueData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Property value data updated successfully"
	});
};
const deletePropertyValueData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Property value data deleted successfully"
	});
};

//#endregion
//#region src/routes/property-value-data.routes.ts
const router$9 = Router();
router$9.get("/", getAllPropertyValueData);
router$9.get("/:id", getPropertyValueDataById);
router$9.post("/", createPropertyValueData);
router$9.put("/:id", updatePropertyValueData);
router$9.delete("/:id", deletePropertyValueData);

//#endregion
//#region src/controllers/demography.controller.ts
const getAllDemography = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Demography fetched successfully"
	});
};
const getDemographyById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Demography fetched successfully"
	});
};
const createDemography = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Demography created successfully"
	});
};
const updateDemography = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Demography updated successfully"
	});
};
const deleteDemography = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Demography deleted successfully"
	});
};

//#endregion
//#region src/routes/demography.routes.ts
const router$8 = Router();
router$8.get("/", getAllDemography);
router$8.get("/:id", getDemographyById);
router$8.post("/", createDemography);
router$8.put("/:id", updateDemography);
router$8.delete("/:id", deleteDemography);

//#endregion
//#region src/controllers/crime-data.controller.ts
const getAllCrimeData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Crime data fetched successfully"
	});
};
const getCrimeDataById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Crime data fetched successfully"
	});
};
const createCrimeData = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Crime data created successfully"
	});
};
const updateCrimeData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Crime data updated successfully"
	});
};
const deleteCrimeData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Crime data deleted successfully"
	});
};

//#endregion
//#region src/routes/crime-data.routes.ts
const router$7 = Router();
router$7.get("/", getAllCrimeData);
router$7.get("/:id", getCrimeDataById);
router$7.post("/", createCrimeData);
router$7.put("/:id", updateCrimeData);
router$7.delete("/:id", deleteCrimeData);

//#endregion
//#region src/controllers/voting-data.controller.ts
const getAllVotingData = async (req, res) => {
	const borough = String(req.query.borough ?? "").trim();
	const response = {
		success: true,
		statusCode: 200,
		data: await prisma.voting_data.findMany({
			where: borough ? { borough: {
				equals: borough,
				mode: "insensitive"
			} } : void 0,
			orderBy: [{ year: "desc" }, { party: "asc" }]
		}),
		message: "Voting data fetched successfully"
	};
	res.status(200).json(response);
};
const getVotingDataById = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Voting data fetched successfully"
	});
};
const createVotingData = async (_req, res) => {
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Voting data created successfully"
	});
};
const updateVotingData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Voting data updated successfully"
	});
};
const deleteVotingData = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		data: null,
		message: "Voting data deleted successfully"
	});
};

//#endregion
//#region src/routes/voting-data.routes.ts
const router$6 = Router();
router$6.get("/", getAllVotingData);
router$6.get("/:id", getVotingDataById);
router$6.post("/", createVotingData);
router$6.put("/:id", updateVotingData);
router$6.delete("/:id", deleteVotingData);

//#endregion
//#region src/controllers/postcode-data.controller.ts
const getPostcodeDataByCode = async (req, res) => {
	const code = String(req.params.code);
	const response = {
		success: true,
		statusCode: 200,
		data: await getPostcodeDataByCode$1(code),
		message: `Postcode data fetched successfully for ${code}`
	};
	res.status(200).json(response);
};

//#endregion
//#region src/routes/postcode-data.routes.ts
const router$5 = Router();
router$5.get("/:code", getPostcodeDataByCode);

//#endregion
//#region src/repositories/score-report.repository.ts
const logContext$3 = {
	service: "ScoreReportRepository",
	function: ""
};
const createScoreReport$1 = async (scoreReport, tx = prisma) => {
	return await tx.scoreReport.create({ data: scoreReport }).catch((err) => {
		logContext$3.function = "createScoreReport";
		logger.error(logContext$3, "Error in createScoreReport repository", { error: err });
		throw new Error("DB: score report create operation failed");
	});
};
const findScoreReportById = async (scoreReportId, select) => {
	return await prisma.scoreReport.findUnique({
		where: { scoreReportId },
		select: select || {
			scoreReportId: true,
			boroughId: true,
			postcodeId: true,
			name: true,
			description: true,
			status: true,
			overallScore: true,
			boroughScore: true,
			postcodeScore: true,
			scoreBreakdown: true,
			reportData: true,
			failureReason: true,
			createdAt: true,
			updatedAt: true
		}
	}).catch((err) => {
		logContext$3.function = "findScoreReportById";
		logger.error(logContext$3, "Error in findScoreReportById repository", { error: err });
		throw new Error("DB: find score report operation failed");
	});
};
const updateScoreReport = async (scoreReportId, data, tx = prisma) => {
	return await tx.scoreReport.update({
		where: { scoreReportId },
		data
	}).catch((err) => {
		logContext$3.function = "updateScoreReport";
		logger.error(logContext$3, "Error in updateScoreReport repository", { error: err });
		throw new Error("DB: score report update operation failed");
	});
};
const recoverScoreReportJobs = async () => {
	await prisma.$executeRaw`
    UPDATE score_reports
    SET status = 'WAITING', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'GENERATING'
      AND updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
  `;
};
const claimNextScoreReportJob = async () => {
	return (await prisma.$queryRaw`
    UPDATE score_reports
    SET status = 'GENERATING', updated_at = CURRENT_TIMESTAMP
    WHERE score_report_id = (
      SELECT score_report_id
      FROM score_reports
      WHERE status = 'WAITING'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING score_report_id AS "scoreReportId"
  `)[0] ?? null;
};
const softDeleteScoreReportForUser = async (scoreReportId, userId) => {
	return (await prisma.scoreReport.updateMany({
		where: {
			scoreReportId,
			userId,
			deletedAt: null
		},
		data: { deletedAt: /* @__PURE__ */ new Date() }
	})).count > 0;
};
const assignScoreReportOwner = async (scoreReportId, userId) => {
	await prisma.$executeRaw`
    UPDATE score_reports SET user_id = ${userId}::uuid, updated_at = CURRENT_TIMESTAMP
    WHERE score_report_id = ${scoreReportId}
  `;
};
const findScoreReportOwner = async (scoreReportId) => {
	return (await prisma.$queryRaw`
    SELECT user_id AS "userId" FROM score_reports WHERE score_report_id = ${scoreReportId} LIMIT 1
  `)[0]?.userId ?? null;
};
const listScoreReportsForUser$1 = async (userId, skip, take) => {
	const where = {
		userId,
		deletedAt: null
	};
	const [reports, total] = await Promise.all([prisma.scoreReport.findMany({
		where,
		orderBy: { createdAt: "desc" },
		skip,
		take,
		select: {
			scoreReportId: true,
			name: true,
			status: true,
			overallScore: true,
			createdAt: true,
			reportData: true,
			reportOrders: {
				where: { userId },
				orderBy: { createdAt: "desc" },
				take: 1,
				select: {
					orderId: true,
					status: true
				}
			}
		}
	}), prisma.scoreReport.count({ where })]);
	return {
		reports,
		total
	};
};

//#endregion
//#region src/dto/score.dto.ts
let ScoreStatus = /* @__PURE__ */ function(ScoreStatus) {
	ScoreStatus["WAITING"] = "WAITING";
	ScoreStatus["GENERATING"] = "GENERATING";
	ScoreStatus["READY"] = "READY";
	ScoreStatus["FAILED"] = "FAILED";
	return ScoreStatus;
}({});
const CreateScoreRequestDto = object({
	boroughId: string().optional(),
	postcodeId: string().optional(),
	name: string().optional(),
	description: string().optional(),
	reportData: record(string(), unknown()).optional()
});
const UpdateScoreRequestDto = object({
	status: nativeEnum(ScoreStatus).optional(),
	name: string().optional(),
	description: string().optional()
});
const ScorePreviewDto = object({
	boroughId: string().optional(),
	postcodeId: string().optional()
});

//#endregion
//#region src/services/score-report.service.ts
const logContext$2 = {
	service: "ScoreReportService",
	function: ""
};
const scoreCategories = [
	{
		name: "safety",
		keys: [
			"crimeScore",
			"crimeIndex",
			"crimeRate"
		],
		max: 100,
		invert: true,
		weight: .2
	},
	{
		name: "affordability",
		keys: [
			"affordabilityScore",
			"costOfLiving",
			"medianRent",
			"medianPrice"
		],
		max: 100,
		invert: true,
		weight: .2
	},
	{
		name: "transport",
		keys: [
			"transportScore",
			"accessScore",
			"publicTransportScore",
			"commuteScore"
		],
		max: 10,
		invert: false,
		weight: .18
	},
	{
		name: "amenities",
		keys: [
			"amenitiesScore",
			"walkScore",
			"leisureScore"
		],
		max: 10,
		invert: false,
		weight: .16
	},
	{
		name: "health",
		keys: [
			"healthScore",
			"airQuality",
			"greenSpace"
		],
		max: 100,
		invert: false,
		weight: .13
	},
	{
		name: "education",
		keys: ["educationScore", "schoolScore"],
		max: 10,
		invert: false,
		weight: .13
	}
];
const normalizeMetric = (value, max = 100, invert = false) => {
	const numeric = typeof value === "number" ? value : Number(value);
	if (Number.isNaN(numeric)) return 0;
	const normalized = Math.max(0, Math.min(1, numeric / max));
	return invert ? 1 - normalized : normalized;
};
const getMetricValue = (metrics, keys) => {
	for (const key of keys) {
		const value = metrics[key];
		if (typeof value === "number" && !Number.isNaN(value)) return value;
		if (typeof value === "string" && value.trim().length > 0) {
			const parsed = Number(value.replace(/[^0-9.\-]+/g, ""));
			if (!Number.isNaN(parsed)) return parsed;
		}
	}
};
const parseMetricNumber = (value) => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string" || value.trim().length === 0) return void 0;
	const parsed = Number(value.replace(/[^0-9.\-]+/g, ""));
	return Number.isFinite(parsed) ? parsed : void 0;
};
const withDerivedScoreMetrics = (metrics) => {
	const derived = { ...metrics };
	const rating = parseMetricNumber(metrics.rating);
	const averageRent = parseMetricNumber(metrics.avgRent);
	const zone = parseMetricNumber(metrics.zones);
	if (getMetricValue(derived, ["score", "quality"]) === void 0 && rating !== void 0) derived.score = Math.max(0, Math.min(100, rating * 20));
	if (getMetricValue(derived, [
		"affordabilityScore",
		"costOfLiving",
		"medianRent",
		"medianPrice"
	]) === void 0 && averageRent !== void 0) derived.affordabilityScore = Math.max(0, Math.min(100, averageRent / 4e3 * 100));
	if (getMetricValue(derived, [
		"transportScore",
		"accessScore",
		"publicTransportScore",
		"commuteScore"
	]) === void 0 && zone !== void 0) derived.transportScore = Math.max(0, Math.min(10, 11 - zone));
	return derived;
};
const calculateMetricsScore = (metrics) => {
	const breakdown = {};
	let weightedSum = 0;
	let totalWeight = 0;
	for (const category of scoreCategories) {
		const metricValue = getMetricValue(metrics, category.keys);
		if (metricValue === void 0) continue;
		const normalized = normalizeMetric(metricValue, category.max, category.invert) * 100;
		breakdown[category.name] = Math.round(normalized);
		weightedSum += normalized * category.weight;
		totalWeight += category.weight;
	}
	const baselineMetric = getMetricValue(metrics, ["score", "quality"]);
	if (totalWeight === 0 && baselineMetric === void 0) return {
		score: null,
		breakdown
	};
	const baseline = baselineMetric === void 0 ? null : normalizeMetric(baselineMetric, 100, false) * 100;
	const combined = totalWeight > 0 ? weightedSum / totalWeight : baseline;
	const score = baseline === null ? Math.round(combined) : Math.round(baseline * .12 + combined * .88);
	return {
		score: Math.max(0, Math.min(100, score)),
		breakdown
	};
};
const combineScores = (boroughScore, postcodeScore) => {
	if (boroughScore === null && postcodeScore === null) return null;
	if (boroughScore !== null && postcodeScore !== null) return Math.round(boroughScore * .55 + postcodeScore * .45);
	return Math.round(boroughScore ?? postcodeScore ?? 0);
};
const buildReportPayload = (report, boroughName, postcodeCode, boroughScore, postcodeScore, scoreBreakdown) => ({
	summary: `RoomReview Score Report for ${report.name ?? boroughName ?? postcodeCode ?? report.scoreReportId}`,
	borough: boroughName,
	postcode: postcodeCode,
	scores: {
		boroughScore,
		postcodeScore,
		overallScore: combineScores(boroughScore, postcodeScore)
	},
	scoreBreakdown,
	createdAt: (/* @__PURE__ */ new Date()).toISOString()
});
const escapePdfText = (text) => {
	return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
};
const pdfTextStyles = {
	title: {
		font: "F2",
		size: 20,
		color: "0.10 0.15 0.23",
		height: 30,
		maxChars: 46
	},
	section: {
		font: "F2",
		size: 11,
		color: "0.55 0.00 0.00",
		height: 23,
		maxChars: 70
	},
	body: {
		font: "F1",
		size: 10,
		color: "0.12 0.16 0.22",
		height: 15,
		maxChars: 92
	},
	muted: {
		font: "F1",
		size: 9,
		color: "0.35 0.39 0.44",
		height: 14,
		maxChars: 98
	}
};
const wrapPdfText = (text, maxChars) => {
	const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
	const wrapped = [];
	let current = "";
	for (const word of words) {
		if (word.length > maxChars) {
			if (current) wrapped.push(current);
			current = "";
			for (let index = 0; index < word.length; index += maxChars) wrapped.push(word.slice(index, index + maxChars));
			continue;
		}
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length > maxChars) {
			wrapped.push(current);
			current = word;
		} else current = candidate;
	}
	if (current) wrapped.push(current);
	return wrapped.length ? wrapped : [""];
};
const formatPdfLabel = (label) => label.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^\w/, (first) => first.toUpperCase());
const appendPdfValue = (lines, label, value) => {
	if (value === null || value === void 0) return;
	if (Array.isArray(value)) {
		value.forEach((item, index) => appendPdfValue(lines, `${label} ${index + 1}`, item));
		return;
	}
	if (typeof value === "object") {
		for (const [key, nestedValue] of Object.entries(value)) appendPdfValue(lines, `${label} - ${formatPdfLabel(key)}`, nestedValue);
		return;
	}
	lines.push({
		text: `${label}: ${String(value)}`,
		kind: "body"
	});
};
const buildPdfBuffer = (report, preparedForName = "") => {
	const reportData = typeof report.reportData === "object" && report.reportData !== null && !Array.isArray(report.reportData) ? report.reportData : {};
	const reportScores = typeof reportData.scores === "object" && reportData.scores !== null ? reportData.scores : {};
	const lines = [
		{
			text: "RoomReview Score Report",
			kind: "title"
		},
		{
			text: "Report details",
			kind: "section"
		},
		...preparedForName ? [{
			text: `Prepared for: ${preparedForName}`,
			kind: "body"
		}] : [],
		{
			text: `Report ID: ${report.scoreReportId}`,
			kind: "muted"
		},
		{
			text: `Name: ${report.name ?? "N/A"}`,
			kind: "body"
		},
		{
			text: `Status: ${report.status}`,
			kind: "body"
		},
		{
			text: `Created: ${new Date(report.createdAt).toLocaleDateString("en-GB")}`,
			kind: "body"
		}
	];
	if (report.description) lines.push({
		text: `Description: ${report.description}`,
		kind: "body"
	});
	const borough = reportData.borough;
	const postcode = reportData.postcode;
	if (borough || postcode) {
		lines.push({
			text: "Location",
			kind: "section"
		});
		if (borough) lines.push({
			text: `Borough: ${String(borough)}`,
			kind: "body"
		});
		if (postcode) lines.push({
			text: `Postcode: ${String(postcode)}`,
			kind: "body"
		});
	}
	lines.push({
		text: "Scores",
		kind: "section"
	});
	lines.push({
		text: `Overall score: ${report.overallScore ?? reportScores.overallScore ?? "N/A"}`,
		kind: "body"
	});
	lines.push({
		text: `Borough score: ${report.boroughScore ?? reportScores.boroughScore ?? "N/A"}`,
		kind: "body"
	});
	lines.push({
		text: `Postcode score: ${report.postcodeScore ?? reportScores.postcodeScore ?? "N/A"}`,
		kind: "body"
	});
	const scoreBreakdown = report.scoreBreakdown ?? reportData.scoreBreakdown;
	if (scoreBreakdown && typeof scoreBreakdown === "object") {
		lines.push({
			text: "Score breakdown",
			kind: "section"
		});
		appendPdfValue(lines, "Score", scoreBreakdown);
	}
	if (typeof reportData.summary === "string" && reportData.summary.trim()) {
		lines.push({
			text: "Summary",
			kind: "section"
		});
		lines.push({
			text: reportData.summary,
			kind: "body"
		});
	}
	const omittedReportDataKeys = new Set([
		"borough",
		"postcode",
		"scores",
		"scoreBreakdown",
		"summary",
		"createdAt"
	]);
	const additionalData = Object.fromEntries(Object.entries(reportData).filter(([key]) => !omittedReportDataKeys.has(key)));
	if (Object.keys(additionalData).length) {
		lines.push({
			text: "Additional report data",
			kind: "section"
		});
		for (const [key, value] of Object.entries(additionalData)) appendPdfValue(lines, formatPdfLabel(key), value);
	}
	const expandedLines = lines.flatMap((line) => {
		const style = pdfTextStyles[line.kind];
		return wrapPdfText(line.text, style.maxChars).map((text) => ({
			...line,
			text
		}));
	});
	const pages = [[]];
	let usedHeight = 0;
	for (const line of expandedLines) {
		const lineHeight = pdfTextStyles[line.kind].height;
		if (usedHeight + lineHeight > 680) {
			pages.push([]);
			usedHeight = 0;
		}
		pages[pages.length - 1].push(line);
		usedHeight += lineHeight;
	}
	const pageObjectRefs = pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
	const objectStrings = [
		"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
		`2 0 obj<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectRefs}] >>endobj\n`,
		"3 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
		"4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n"
	];
	pages.forEach((page, pageIndex) => {
		const pageObjectId = 5 + pageIndex * 2;
		const contentObjectId = pageObjectId + 1;
		let y = 750;
		const commands = page.map((line) => {
			const style = pdfTextStyles[line.kind];
			const command = `${style.color} rg BT /${style.font} ${style.size} Tf 50 ${y} Td (${escapePdfText(line.text)}) Tj ET`;
			y -= style.height;
			return command;
		});
		commands.push(`0.45 0.48 0.52 rg BT /F1 8 Tf 50 30 Td (${pageIndex + 1} / ${pages.length}) Tj ET`);
		const stream = commands.join("\n");
		const streamBytes = Buffer.from(stream, "utf8");
		objectStrings.push(`${pageObjectId} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>endobj\n`, `${contentObjectId} 0 obj<< /Length ${streamBytes.length} >>stream\n${stream}\nendstream\nendobj\n`);
	});
	let offset = Buffer.byteLength("%PDF-1.1\n");
	const xrefEntries = ["0000000000 65535 f \n"];
	for (const objectString of objectStrings) {
		xrefEntries.push(`${offset.toString().padStart(10, "0")} 00000 n \n`);
		offset += Buffer.byteLength(objectString);
	}
	const xrefStart = offset;
	const xref = `xref\n0 ${objectStrings.length + 1}\n${xrefEntries.join("")}`;
	const trailer = `trailer<< /Size ${objectStrings.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
	return Buffer.concat([
		Buffer.from("%PDF-1.1\n", "utf8"),
		Buffer.from(objectStrings.join(""), "utf8"),
		Buffer.from(xref, "utf8"),
		Buffer.from(trailer, "utf8")
	]);
};
const calculateMetrics = (metrics = {}) => {
	const { score, breakdown } = calculateMetricsScore(withDerivedScoreMetrics(metrics));
	return {
		score,
		breakdown
	};
};
const calculateLocationScores = (boroughMetrics, hasPostcode, postcodeMetrics = boroughMetrics) => {
	const boroughResult = calculateMetrics(boroughMetrics);
	const postcodeResult = hasPostcode ? calculateMetrics(postcodeMetrics) : {
		score: null,
		breakdown: {}
	};
	return {
		boroughResult,
		postcodeResult,
		overallScore: combineScores(boroughResult.score, postcodeResult.score)
	};
};
const createScoreReportRequest = async (data, userId) => {
	if (!data.boroughId && !data.postcodeId) throw new ValidationError({
		message: "Either boroughId or postcodeId must be provided",
		code: "VALIDATION_ERROR"
	});
	const borough = data.boroughId ? await findBoroughById(data.boroughId) : null;
	if (data.boroughId && !borough) throw new EntityNotFoundError({
		message: `Borough with ID ${data.boroughId} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	const postcode = data.postcodeId ? await findPostcodeById(data.postcodeId) : null;
	if (data.postcodeId && !postcode) throw new EntityNotFoundError({
		message: `Postcode with ID ${data.postcodeId} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	const reportData = data.reportData;
	const reportMeta = typeof reportData?.meta === "object" && reportData.meta !== null ? reportData.meta : {};
	const reportMetrics = typeof reportData?.metrics === "object" && reportData.metrics !== null ? reportData.metrics : {};
	const overallScoreValue = reportMeta.overallScore ?? reportMetrics.score;
	const overallScore = typeof overallScoreValue === "number" && Number.isFinite(overallScoreValue) ? overallScoreValue : void 0;
	const report = await createScoreReport$1({
		borough: data.boroughId ? { connect: { boroughId: data.boroughId } } : void 0,
		postcode: data.postcodeId ? { connect: { postcodeId: data.postcodeId } } : void 0,
		name: data.name,
		description: data.description,
		status: reportData ? "READY" : "WAITING",
		overallScore,
		scoreBreakdown: reportData?.scoreBreakdown ?? reportData?.availableScoreCategories,
		reportData
	});
	await assignScoreReportOwner(report.scoreReportId, userId);
	return report;
};
const listScoreReportsForUser = async (userId, requestedPage = 1, requestedLimit = 5) => {
	const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
	const limit = Number.isFinite(requestedLimit) ? Math.min(5, Math.max(1, Math.floor(requestedLimit))) : 5;
	const { reports, total } = await listScoreReportsForUser$1(userId, (page - 1) * limit, limit);
	return {
		reports: reports.map(({ reportOrders, reportData, ...report }) => {
			const reportType = typeof reportData === "object" && reportData !== null && !Array.isArray(reportData) ? reportData.reportType : null;
			return {
				...report,
				hasFullReport: reportType === "buyer" || reportType === "investor",
				order: reportOrders[0] ?? null
			};
		}),
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		}
	};
};
const deleteUserScoreReport = async (scoreReportId, userId) => {
	if (!await softDeleteScoreReportForUser(scoreReportId, userId)) throw new EntityNotFoundError({
		message: "Report not found",
		code: "ENTITY_NOT_FOUND"
	});
};
const getScoreReportById = async (id) => {
	const report = await findScoreReportById(id);
	if (!report) throw new EntityNotFoundError({
		message: `Score report with ID ${id} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	return report;
};
const generateScoreReportNow = async (id) => {
	const report = await getScoreReportById(id);
	const postcode = report.postcodeId ? await findPostcodeById(report.postcodeId) : null;
	const boroughId = report.boroughId ?? postcode?.boroughId;
	const borough = boroughId ? await findBoroughById(boroughId) : null;
	const boroughMetrics = (borough ? borough.metrics : {}) ?? {};
	const postcodeMetrics = (postcode ? postcode.metrics : {}) ?? {};
	const { boroughResult, postcodeResult, overallScore } = calculateLocationScores(boroughMetrics, Boolean(postcode), postcodeMetrics);
	const scoreBreakdown = {
		borough: boroughResult.breakdown,
		postcode: postcodeResult.breakdown
	};
	const boroughScore = boroughResult.score;
	const postcodeScore = postcodeResult.score;
	const reportData = buildReportPayload(report, borough?.name ?? null, postcode?.code ?? null, boroughScore, postcodeScore, scoreBreakdown);
	return await updateScoreReport(id, {
		status: "READY",
		overallScore,
		boroughScore,
		postcodeScore,
		scoreBreakdown,
		reportData,
		failureReason: null
	});
};
const processNextScoreReportJob = async () => {
	await recoverScoreReportJobs();
	const job = await claimNextScoreReportJob();
	if (!job) return false;
	logContext$2.function = "processNextScoreReportJob";
	try {
		await generateScoreReportNow(job.scoreReportId);
	} catch (error) {
		logger.error(logContext$2, "Background score report generation failed", {
			error,
			scoreReportId: job.scoreReportId
		});
		await updateScoreReport(job.scoreReportId, {
			status: "FAILED",
			failureReason: error instanceof Error ? error.message : "Unknown error"
		}).catch(() => null);
	}
	return true;
};
const processScoreReportJobsOnce = async () => {
	while (await processNextScoreReportJob());
};
let scoreReportWorkerStarted = false;
const startScoreReportWorker = async () => {
	if (scoreReportWorkerStarted) return;
	scoreReportWorkerStarted = true;
	const run = async () => {
		try {
			await processScoreReportJobsOnce();
		} catch (error) {
			logger.error(logContext$2, "Score report worker poll failed", { error });
		} finally {
			setTimeout(run, 1e3).unref();
		}
	};
	run();
};
const enqueueScoreReportGeneration$1 = async (id) => {
	const report = await getScoreReportById(id);
	if (report.status === "GENERATING" || report.status === "READY") return report;
	await updateScoreReport(id, {
		status: "WAITING",
		failureReason: null
	});
	return await getScoreReportById(id);
};
const previewScoreReport$1 = async (data) => {
	if (!data.boroughId && !data.postcodeId) throw new ValidationError({
		message: "Either boroughId or postcodeId must be provided",
		code: "VALIDATION_ERROR"
	});
	const postcode = data.postcodeId ? await findPostcodeById(data.postcodeId) : null;
	if (data.postcodeId && !postcode) throw new EntityNotFoundError({
		message: `Postcode with ID ${data.postcodeId} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	const boroughId = data.boroughId ?? postcode?.boroughId;
	const borough = boroughId ? await findBoroughById(boroughId) : null;
	if (boroughId && !borough) throw new EntityNotFoundError({
		message: `Borough with ID ${boroughId} not found`,
		code: "ENTITY_NOT_FOUND"
	});
	const { boroughResult, postcodeResult, overallScore } = calculateLocationScores(borough?.metrics ?? {}, Boolean(postcode), postcode?.metrics ?? {});
	return {
		borough: borough?.name,
		postcode: postcode?.code,
		overallScore,
		boroughScore: boroughResult.score,
		postcodeScore: postcodeResult.score,
		scoreBreakdown: {
			borough: boroughResult.breakdown,
			postcode: postcodeResult.breakdown
		},
		preview: {
			boroughMetrics: borough?.metrics,
			postcodeMetrics: postcode?.metrics
		}
	};
};
const generateScoreReportPdf = async (id, preparedForName = "") => {
	const report = await getScoreReportById(id);
	if (report.status !== "READY") throw new ValidationError({
		message: "Score report must be READY before PDF generation",
		code: "VALIDATION_ERROR"
	});
	return buildPdfBuffer(report, preparedForName);
};

//#endregion
//#region src/repositories/report-order.repository.ts
const findReportOrder = async (orderId, userId) => {
	return (userId ? await prisma.$queryRaw`
      SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
        stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
        amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
      FROM report_orders WHERE order_id = ${orderId}::uuid AND user_id = ${userId}::uuid LIMIT 1
    ` : await prisma.$queryRaw`
      SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
        stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
        amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
      FROM report_orders WHERE order_id = ${orderId}::uuid LIMIT 1
    `)[0] ?? null;
};
const findReportOrderForReport = async (scoreReportId, userId) => {
	return (await prisma.$queryRaw`
    SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
      stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
      amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
    FROM report_orders
    WHERE score_report_id = ${scoreReportId} AND user_id = ${userId}::uuid
    ORDER BY created_at DESC LIMIT 1
  `)[0] ?? null;
};
const findReportOrderBySession = async (sessionId, userId) => {
	return (await prisma.$queryRaw`
    SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
      stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
      amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
    FROM report_orders
    WHERE stripe_session_id = ${sessionId} AND user_id = ${userId}::uuid
    LIMIT 1
  `)[0] ?? null;
};
const createReportOrder = async (userId, scoreReportId, amount, currency) => {
	const orderId = randomUUID();
	await prisma.$executeRaw`
    INSERT INTO report_orders (order_id, user_id, score_report_id, amount, currency)
    VALUES (${orderId}::uuid, ${userId}::uuid, ${scoreReportId}, ${amount}, ${currency})
  `;
	return findReportOrder(orderId, userId);
};
const setStripeSession = async (orderId, sessionId) => {
	await prisma.$executeRaw`UPDATE report_orders SET stripe_session_id = ${sessionId}, updated_at = CURRENT_TIMESTAMP WHERE order_id = ${orderId}::uuid`;
};
const markOrderPaid = async (sessionId, paymentIntent) => {
	await prisma.$executeRaw`
    UPDATE report_orders
    SET status = 'PAID', stripe_payment_intent = ${paymentIntent}, paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
    WHERE stripe_session_id = ${sessionId}
  `;
	return (await prisma.$queryRaw`
    SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
      stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
      amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
    FROM report_orders WHERE stripe_session_id = ${sessionId} LIMIT 1
  `)[0] ?? null;
};
const markOrderFailed = async (sessionId, paymentIntent) => {
	await prisma.$executeRaw`
    UPDATE report_orders
    SET status = 'FAILED', stripe_payment_intent = COALESCE(${paymentIntent}::text, stripe_payment_intent), updated_at = CURRENT_TIMESTAMP
    WHERE status = 'PENDING'
      AND (
        (${sessionId}::text IS NOT NULL AND stripe_session_id = ${sessionId}::text)
        OR (${paymentIntent}::text IS NOT NULL AND stripe_payment_intent = ${paymentIntent}::text)
      )
  `;
};
const markOrderCancelled = async (sessionId) => {
	await prisma.$executeRaw`UPDATE report_orders SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE stripe_session_id = ${sessionId} AND status = 'PENDING'`;
};
const listReportOrders = async (userId) => prisma.$queryRaw`
  SELECT report_orders.order_id AS "orderId", report_orders.user_id AS "userId", report_orders.score_report_id AS "scoreReportId",
    report_orders.stripe_session_id AS "stripeSessionId", report_orders.stripe_payment_intent AS "stripePaymentIntent",
    report_orders.amount, report_orders.currency, report_orders.status, report_orders.paid_at AS "paidAt", report_orders.created_at AS "createdAt",
    score_reports.status AS "reportStatus"
  FROM report_orders
  LEFT JOIN score_reports ON score_reports.score_report_id = report_orders.score_report_id
  WHERE report_orders.user_id = ${userId}::uuid ORDER BY report_orders.created_at DESC
`;
const claimWebhookEvent = async (eventId, eventType) => {
	return await prisma.$executeRaw`
    INSERT INTO payment_webhook_events (event_id, event_type, status)
    VALUES (${eventId}, ${eventType}, 'PROCESSING')
    ON CONFLICT (event_id) DO UPDATE
      SET status = 'PROCESSING', processed_at = CURRENT_TIMESTAMP
      WHERE payment_webhook_events.status = 'FAILED'
        OR payment_webhook_events.processed_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
  ` === 1;
};
const completeWebhookEvent = async (eventId) => {
	await prisma.$executeRaw`
    UPDATE payment_webhook_events
    SET status = 'COMPLETED', processed_at = CURRENT_TIMESTAMP
    WHERE event_id = ${eventId}
  `;
};
const failWebhookEvent = async (eventId) => {
	await prisma.$executeRaw`
    UPDATE payment_webhook_events
    SET status = 'FAILED', processed_at = CURRENT_TIMESTAMP
    WHERE event_id = ${eventId}
  `;
};

//#endregion
//#region src/repositories/billing.repository.ts
const findBillingSubscription = async (userId) => {
	return (await prisma.$queryRaw`
    SELECT billing_subscription_id AS "billingSubscriptionId", user_id AS "userId",
      stripe_customer_id AS "stripeCustomerId", stripe_subscription_id AS "stripeSubscriptionId",
      status, current_period_end AS "currentPeriodEnd", cancel_at_period_end AS "cancelAtPeriodEnd"
    FROM billing_subscriptions WHERE user_id = ${userId}::uuid LIMIT 1
  `)[0] ?? null;
};
const findBillingSubscriptionByStripeId = async (stripeSubscriptionId) => {
	return (await prisma.$queryRaw`
    SELECT billing_subscription_id AS "billingSubscriptionId", user_id AS "userId",
      stripe_customer_id AS "stripeCustomerId", stripe_subscription_id AS "stripeSubscriptionId",
      status, current_period_end AS "currentPeriodEnd", cancel_at_period_end AS "cancelAtPeriodEnd"
    FROM billing_subscriptions WHERE stripe_subscription_id = ${stripeSubscriptionId} LIMIT 1
  `)[0] ?? null;
};
const saveBillingSubscription = async (data) => {
	const id = randomUUID();
	await prisma.$executeRaw`
    INSERT INTO billing_subscriptions
      (billing_subscription_id, user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end)
    VALUES (${id}::uuid, ${data.userId}::uuid, ${data.stripeCustomerId}, ${data.stripeSubscriptionId}, ${data.status}::"BillingSubscriptionStatus", ${data.currentPeriodEnd}, ${data.cancelAtPeriodEnd})
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = CURRENT_TIMESTAMP
  `;
	return findBillingSubscription(data.userId);
};
const updateBillingSubscription = async (stripeSubscriptionId, data) => {
	await prisma.$executeRaw`
    UPDATE billing_subscriptions
    SET status = ${data.status}::"BillingSubscriptionStatus",
      current_period_end = COALESCE(${data.currentPeriodEnd ?? null}, current_period_end),
      cancel_at_period_end = COALESCE(${data.cancelAtPeriodEnd ?? null}, cancel_at_period_end),
      updated_at = CURRENT_TIMESTAMP
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
};
const grantSubscriptionCredits = async (data) => {
	return prisma.$transaction(async (tx) => {
		if (await tx.$executeRaw`
      INSERT INTO billing_credit_grants (billing_credit_grant_id, user_id, stripe_event_id, stripe_invoice_id, credits)
      VALUES (${randomUUID()}::uuid, ${data.userId}::uuid, ${data.eventId}, ${data.invoiceId}, ${data.credits})
      ON CONFLICT (stripe_event_id) DO NOTHING
    ` === 0) return false;
		const existing = await tx.$queryRaw`
      SELECT user_credits_id AS "userCreditsId", credits_balance AS balance
      FROM user_credits WHERE user_id = ${data.userId}::uuid LIMIT 1
    `;
		const balanceBefore = existing[0]?.balance ?? 0;
		const userCreditsId = existing[0]?.userCreditsId ?? randomUUID();
		if (existing.length === 0) await tx.$executeRaw`
        INSERT INTO user_credits (user_credits_id, user_id, credits_balance, subscription_plan, created_at, updated_at)
        VALUES (${userCreditsId}::uuid, ${data.userId}::uuid, ${data.credits}, 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
		else await tx.$executeRaw`
        UPDATE user_credits SET credits_balance = credits_balance + ${data.credits}, updated_at = CURRENT_TIMESTAMP
        WHERE user_credits_id = ${userCreditsId}::uuid
      `;
		await tx.$executeRaw`
      INSERT INTO credit_transactions
        (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${userCreditsId}::uuid, ${data.credits}, 'SUBSCRIPTION', 'Monthly report subscription credits', ${balanceBefore + data.credits}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
		return true;
	});
};
const consumeReportCredit = async (userId, scoreReportId) => {
	return prisma.$transaction(async (tx) => {
		if (await tx.$executeRaw`
      INSERT INTO report_credit_consumptions (report_credit_consumption_id, user_id, score_report_id)
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${scoreReportId})
      ON CONFLICT (score_report_id) DO NOTHING
    ` === 0) return true;
		const credits = await tx.$queryRaw`
      SELECT user_credits_id AS "userCreditsId", credits_balance AS balance
      FROM user_credits WHERE user_id = ${userId}::uuid LIMIT 1
    `;
		if (!credits[0] || credits[0].balance < 1) {
			await tx.$executeRaw`DELETE FROM report_credit_consumptions WHERE score_report_id = ${scoreReportId}`;
			return false;
		}
		const balanceAfter = credits[0].balance - 1;
		await tx.$executeRaw`
      UPDATE user_credits SET credits_balance = ${balanceAfter}, updated_at = CURRENT_TIMESTAMP
      WHERE user_credits_id = ${credits[0].userCreditsId}::uuid
    `;
		await tx.$executeRaw`
      INSERT INTO credit_transactions
        (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${credits[0].userCreditsId}::uuid, -1, 'DOWNLOAD', 'Report credit used', ${balanceAfter}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
		return true;
	});
};
const grantEarlyAccessReportCredits = async (userId) => {
	return prisma.$transaction(async (tx) => {
		if ((await tx.$queryRaw`
      SELECT user_id AS "userId"
      FROM users
      WHERE user_id = ${userId}::uuid
        AND role = 'TENANT'
        AND trial_ends_at > CURRENT_TIMESTAMP
      LIMIT 1
    `).length === 0) return false;
		const credits = 3;
		const eventId = `early-access-trial:${userId}`;
		if (await tx.$executeRaw`
      INSERT INTO billing_credit_grants
        (billing_credit_grant_id, user_id, stripe_event_id, stripe_invoice_id, credits)
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${eventId}, NULL, ${credits})
      ON CONFLICT (stripe_event_id) DO NOTHING
    ` === 0) return false;
		const existingCredits = await tx.$queryRaw`
      SELECT user_credits_id AS "userCreditsId", credits_balance AS balance
      FROM user_credits
      WHERE user_id = ${userId}::uuid
      LIMIT 1
      FOR UPDATE
    `;
		const userCreditsId = existingCredits[0]?.userCreditsId ?? randomUUID();
		const balanceAfter = (existingCredits[0]?.balance ?? 0) + credits;
		if (existingCredits.length > 0) await tx.$executeRaw`
        UPDATE user_credits
        SET credits_balance = ${balanceAfter}, updated_at = CURRENT_TIMESTAMP
        WHERE user_credits_id = ${userCreditsId}::uuid
      `;
		else await tx.$executeRaw`
        INSERT INTO user_credits
          (user_credits_id, user_id, credits_balance, subscription_plan, created_at, updated_at)
        VALUES (${userCreditsId}::uuid, ${userId}::uuid, ${balanceAfter}, 'FREE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
		await tx.$executeRaw`
      INSERT INTO credit_transactions
        (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${userCreditsId}::uuid, ${credits}, 'BONUS', 'Early access: three free branded reports', ${balanceAfter}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
		return true;
	});
};
const getBillingStatus = async (userId) => {
	await grantEarlyAccessReportCredits(userId);
	const subscription = await findBillingSubscription(userId);
	const trial = (await prisma.$queryRaw`
    SELECT users.trial_started_at AS "trialStartedAt", users.trial_ends_at AS "trialEndsAt",
      user_credits.credits_balance AS "creditsBalance"
    FROM users LEFT JOIN user_credits ON user_credits.user_id = users.user_id
    WHERE users.user_id = ${userId}::uuid LIMIT 1
  `)[0] ?? {
		trialStartedAt: null,
		trialEndsAt: null,
		creditsBalance: 0
	};
	return {
		trial,
		trialActive: Boolean(trial.trialEndsAt && trial.trialEndsAt > /* @__PURE__ */ new Date()),
		creditsBalance: trial.creditsBalance ?? 0,
		subscription
	};
};

//#endregion
//#region src/services/payment.service.ts
const logContext$1 = {
	service: "payment.service",
	function: "handleWebhook"
};
const toDate = (value) => value ? /* @__PURE__ */ new Date(value * 1e3) : null;
const mapSubscriptionStatus = (status) => {
	if (status === "active") return "ACTIVE";
	if (status === "past_due") return "PAST_DUE";
	if (status === "canceled") return "CANCELED";
	if (status === "unpaid") return "UNPAID";
	return "INCOMPLETE";
};
const stripeRequest = async (path, body) => {
	if (!config.stripeSecretKey) throw new InternalServerError({
		message: "Stripe is not configured",
		code: "INTERNAL_SERVER_ERROR"
	});
	const response = await fetch(`https://api.stripe.com/v1/${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.stripeSecretKey}`,
			"Content-Type": "application/x-www-form-urlencoded"
		},
		body
	});
	const data = await response.json();
	if (!response.ok) throw new InternalServerError({
		message: data.error?.message ?? "Stripe request failed",
		code: "INTERNAL_SERVER_ERROR"
	});
	return data;
};
const stripeGet = async (path) => {
	if (!config.stripeSecretKey) throw new InternalServerError({
		message: "Stripe is not configured",
		code: "INTERNAL_SERVER_ERROR"
	});
	const response = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${config.stripeSecretKey}` } });
	const data = await response.json();
	if (!response.ok) throw new InternalServerError({
		message: data.error?.message ?? "Stripe request failed",
		code: "INTERNAL_SERVER_ERROR"
	});
	return data;
};
const createCheckout$1 = async (scoreReportId, userId) => {
	const owner = await findScoreReportOwner(scoreReportId);
	if (!owner) throw new EntityNotFoundError({
		message: "Score report not found",
		code: "ENTITY_NOT_FOUND"
	});
	if (owner !== userId) throw new UnauthorizedError({ message: "You do not own this report" });
	const existing = await findReportOrderForReport(scoreReportId, userId);
	if (existing?.status === "PAID") return {
		order: existing,
		checkoutUrl: null
	};
	const order = existing ?? await createReportOrder(userId, scoreReportId, config.stripeReportAmount, config.stripeCurrency);
	if (!order) throw new InternalServerError({
		message: "Unable to create report order",
		code: "INTERNAL_SERVER_ERROR"
	});
	const form = new URLSearchParams({
		mode: "payment",
		success_url: config.stripeSuccessUrl,
		cancel_url: config.stripeCancelUrl,
		customer_creation: "always",
		"line_items[0][quantity]": "1",
		"metadata[orderId]": order.orderId,
		"metadata[reportId]": scoreReportId,
		"metadata[userId]": userId
	});
	if (config.stripeReportPriceId) form.set("line_items[0][price]", config.stripeReportPriceId);
	else {
		form.set("line_items[0][price_data][currency]", config.stripeCurrency);
		form.set("line_items[0][price_data][unit_amount]", String(config.stripeReportAmount));
		form.set("line_items[0][price_data][product_data][name]", "RoomReview property report");
	}
	const session = await stripeRequest("checkout/sessions", form);
	await setStripeSession(order.orderId, session.id);
	return {
		order: {
			...order,
			stripeSessionId: session.id
		},
		checkoutUrl: session.url
	};
};
const createSubscriptionCheckout$1 = async (userId) => {
	const billing = await getBillingStatus(userId);
	if (billing.trialActive) throw new ValidationError({
		message: "Your free trial is still active",
		code: "VALIDATION_ERROR"
	});
	if (billing.subscription?.status === "ACTIVE") return {
		checkoutUrl: null,
		subscription: billing.subscription
	};
	const form = new URLSearchParams({
		mode: "subscription",
		success_url: config.stripeSuccessUrl,
		cancel_url: config.stripeCancelUrl,
		"line_items[0][quantity]": "1",
		"subscription_data[metadata][userId]": userId,
		"subscription_data[metadata][credits]": String(config.stripeSubscriptionCredits),
		"metadata[userId]": userId
	});
	if (config.stripeSubscriptionPriceId) form.set("line_items[0][price]", config.stripeSubscriptionPriceId);
	else {
		form.set("line_items[0][price_data][currency]", config.stripeCurrency);
		form.set("line_items[0][price_data][unit_amount]", String(config.stripeSubscriptionAmount));
		form.set("line_items[0][price_data][recurring][interval]", "month");
		form.set("line_items[0][price_data][product_data][name]", "RoomReview - 10 reports per month");
	}
	return {
		checkoutUrl: (await stripeRequest("checkout/sessions", form)).url,
		subscription: null
	};
};
const verifyWebhook = (payload, signature) => {
	if (!config.stripeWebhookSecret) throw new UnauthorizedError({ message: "Stripe webhook is not configured" });
	const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=")));
	const timestamp = parts.t;
	const received = parts.v1;
	if (!timestamp || !received || Math.abs(Date.now() / 1e3 - Number(timestamp)) > 300) throw new UnauthorizedError({ message: "Invalid Stripe webhook signature" });
	const expected = createHmac("sha256", config.stripeWebhookSecret).update(`${timestamp}.${payload.toString("utf8")}`).digest("hex");
	if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) throw new UnauthorizedError({ message: "Invalid Stripe webhook signature" });
	return JSON.parse(payload.toString("utf8"));
};
const handleWebhook$1 = async (payload, signature) => {
	const event = verifyWebhook(payload, signature);
	if (!await claimWebhookEvent(event.id, event.type)) {
		logger.info(logContext$1, "Duplicate Stripe webhook ignored", {
			eventId: event.id,
			eventType: event.type
		});
		return {
			handled: true,
			duplicate: true
		};
	}
	try {
		const result = await processWebhookEvent(event);
		await completeWebhookEvent(event.id);
		return result;
	} catch (error) {
		await failWebhookEvent(event.id).catch(() => null);
		throw error;
	}
};
const processWebhookEvent = async (event) => {
	logger.info(logContext$1, "Stripe webhook received", {
		eventId: event.id,
		eventType: event.type
	});
	if (event.type === "checkout.session.async_payment_failed") {
		const session = event.data.object;
		await markOrderFailed(session.id, session.payment_intent ?? null);
		logger.warn(logContext$1, "Stripe checkout payment failed", {
			eventId: event.id,
			sessionId: session.id
		});
		return { handled: true };
	}
	if (event.type === "payment_intent.payment_failed") {
		const paymentIntent = event.data.object;
		await markOrderFailed(null, paymentIntent.id);
		logger.warn(logContext$1, "Stripe payment intent failed", {
			eventId: event.id,
			paymentIntentId: paymentIntent.id
		});
		return { handled: true };
	}
	if (event.type === "checkout.session.expired") {
		await markOrderCancelled(event.data.object.id);
		logger.info(logContext$1, "Stripe checkout session expired", {
			eventId: event.id,
			sessionId: event.data.object.id
		});
		return { handled: true };
	}
	if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
		const subscription = event.data.object;
		await updateBillingSubscription(subscription.id, {
			status: mapSubscriptionStatus(subscription.status),
			currentPeriodEnd: toDate(subscription.current_period_end),
			cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
		});
		logger.info(logContext$1, "Stripe subscription status updated", {
			eventId: event.id,
			subscriptionId: subscription.id,
			status: subscription.status
		});
		return { handled: true };
	}
	if (event.type === "invoice.payment_failed") {
		const invoice = event.data.object;
		const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
		if (subscriptionId) await updateBillingSubscription(subscriptionId, { status: "PAST_DUE" });
		logger.warn(logContext$1, "Stripe invoice payment failed", {
			eventId: event.id,
			invoiceId: invoice.id,
			subscriptionId
		});
		return { handled: Boolean(subscriptionId) };
	}
	if (event.type === "invoice.paid") {
		const invoice = event.data.object;
		const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
		if (!subscriptionId) return { handled: false };
		let subscription = await findBillingSubscriptionByStripeId(subscriptionId);
		if (!subscription) {
			const stripeSubscription = await stripeGet(`subscriptions/${subscriptionId}`);
			const userId = stripeSubscription.metadata?.userId;
			if (!userId) return { handled: false };
			subscription = await saveBillingSubscription({
				userId,
				stripeCustomerId: stripeSubscription.customer ?? null,
				stripeSubscriptionId: stripeSubscription.id,
				status: mapSubscriptionStatus(stripeSubscription.status),
				currentPeriodEnd: toDate(stripeSubscription.current_period_end),
				cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end)
			});
		}
		const granted = await grantSubscriptionCredits({
			userId: subscription.userId,
			eventId: event.id,
			invoiceId: invoice.id,
			credits: config.stripeSubscriptionCredits
		});
		logger.info(logContext$1, "Stripe invoice processed", {
			eventId: event.id,
			invoiceId: invoice.id,
			subscriptionId,
			creditsGranted: granted
		});
		return { handled: granted };
	}
	if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return { handled: false };
	const session = event.data.object;
	if (session.mode === "subscription" && session.subscription && session.metadata?.userId) {
		await saveBillingSubscription({
			userId: session.metadata.userId,
			stripeCustomerId: session.customer ?? null,
			stripeSubscriptionId: session.subscription,
			status: "ACTIVE",
			currentPeriodEnd: null,
			cancelAtPeriodEnd: false
		});
		logger.info(logContext$1, "Stripe subscription checkout completed", {
			eventId: event.id,
			sessionId: session.id,
			subscriptionId: session.subscription
		});
		return { handled: true };
	}
	if (event.type === "checkout.session.completed" && session.payment_status && session.payment_status !== "paid") {
		logger.info(logContext$1, "Stripe checkout completed before payment settlement", {
			eventId: event.id,
			sessionId: session.id,
			paymentStatus: session.payment_status
		});
		return { handled: false };
	}
	const order = await markOrderPaid(session.id, session.payment_intent ?? null);
	if (order) await enqueueScoreReportGeneration$1(order.scoreReportId);
	logger.info(logContext$1, "Stripe report checkout completed", {
		eventId: event.id,
		sessionId: session.id,
		orderId: order?.orderId,
		handled: Boolean(order)
	});
	return { handled: Boolean(order) };
};
const confirmCheckout$1 = async (sessionId, userId) => {
	const session = await stripeGet(`checkout/sessions/${encodeURIComponent(sessionId)}`);
	const order = await findReportOrderBySession(sessionId, userId);
	const sessionUserId = session.metadata?.userId;
	if (!order && sessionUserId !== userId) throw new UnauthorizedError({ message: "You do not have access to this checkout session" });
	return {
		sessionId: session.id,
		status: order?.status ?? (session.payment_status === "paid" ? "PENDING" : "FAILED"),
		paymentStatus: session.payment_status ?? null,
		orderId: order?.orderId ?? null,
		scoreReportId: order?.scoreReportId ?? null
	};
};
const getOrderHistory$1 = (userId) => listReportOrders(userId);
const getBilling$1 = (userId) => getBillingStatus(userId);
const assertReportOwner = async (scoreReportId, userId) => {
	const owner = await findScoreReportOwner(scoreReportId);
	if (!owner) throw new EntityNotFoundError({
		message: "Score report not found",
		code: "ENTITY_NOT_FOUND"
	});
	if (owner !== userId) throw new UnauthorizedError({ message: "You do not own this report" });
};
const assertPaidReportAccess = async (scoreReportId, userId) => {
	await assertReportOwner(scoreReportId, userId);
	const order = await findReportOrderForReport(scoreReportId, userId);
	if (order?.status === "PAID") return order;
	if (await consumeReportCredit(userId, scoreReportId)) return {
		status: "PAID",
		scoreReportId,
		userId
	};
	throw new UnauthorizedError({ message: "A paid order or available report credit is required to access this report" });
};
const cancelSubscriptionAtPeriodEnd = async (userId) => {
	const billing = await getBillingStatus(userId);
	if (!billing.subscription) throw new EntityNotFoundError({
		message: "Active subscription not found",
		code: "ENTITY_NOT_FOUND"
	});
	await stripeRequest(`subscriptions/${encodeURIComponent(billing.subscription.stripeSubscriptionId)}`, new URLSearchParams({ cancel_at_period_end: "true" }));
	await updateBillingSubscription(billing.subscription.stripeSubscriptionId, {
		status: billing.subscription.status,
		cancelAtPeriodEnd: true
	});
	return getBillingStatus(userId);
};

//#endregion
//#region src/controllers/score-report.controller.ts
const getSingleParamValue = (value) => {
	if (typeof value === "string") return value;
	return value?.[0] ?? "";
};
const createScoreReport = async (req, res) => {
	const response = {
		success: true,
		statusCode: 201,
		data: await createScoreReportRequest(req.body, req.user.userId),
		message: "Score report request created successfully"
	};
	res.status(201).json(response);
};
const listMyScoreReports = async (req, res) => {
	const queryValue = (value, fallback) => {
		const parsed = Number(Array.isArray(value) ? value[0] : value);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
	};
	const response = {
		success: true,
		statusCode: 200,
		data: await listScoreReportsForUser(req.user.userId, queryValue(req.query.page, 1), queryValue(req.query.limit, 5)),
		message: "User reports fetched successfully"
	};
	res.status(200).json(response);
};
const deleteMyScoreReport = async (req, res) => {
	const id = getSingleParamValue(req.params.id);
	await deleteUserScoreReport(id, req.user.userId);
	const response = {
		success: true,
		statusCode: 200,
		data: { scoreReportId: id },
		message: "Report removed from your saved reports"
	};
	res.status(200).json(response);
};
const getScoreReport = async (req, res) => {
	const id = getSingleParamValue(req.params.id);
	await assertReportOwner(id, req.user.userId);
	const response = {
		success: true,
		statusCode: 200,
		data: await getScoreReportById(id),
		message: "Score report fetched successfully"
	};
	res.status(200).json(response);
};
const enqueueScoreReportGeneration = async (req, res) => {
	const id = getSingleParamValue(req.params.id);
	await assertPaidReportAccess(id, req.user.userId);
	const response = {
		success: true,
		statusCode: 202,
		data: await enqueueScoreReportGeneration$1(id),
		message: "Score report generation started"
	};
	res.status(202).json(response);
};
const previewScoreReport = async (req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await previewScoreReport$1(req.body),
		message: "Score report preview generated successfully"
	};
	res.status(200).json(response);
};
const getScoreReportPdf = async (req, res) => {
	const id = getSingleParamValue(req.params.id);
	await assertReportOwner(id, req.user.userId);
	if ((await getScoreReportById(id)).status !== "READY") throw new ValidationError({
		message: "Score report must be READY before PDF generation",
		code: "VALIDATION_ERROR"
	});
	await assertPaidReportAccess(id, req.user.userId);
	const profile = await getCurrentUserProfile(req.user.userId);
	const preparedForName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
	const pdfBuffer = await generateScoreReportPdf(id, preparedForName);
	res.setHeader("Content-Type", "application/pdf");
	res.setHeader("Content-Disposition", `attachment; filename="score-report-${id}.pdf"`);
	res.status(200).send(pdfBuffer);
};

//#endregion
//#region src/routes/score-report.routes.ts
/**
* @swagger
* tags:
*   name: ScoreReports
*   description: Score report management and generation
* components:
*   securitySchemes:
*     bearerAuth:
*       type: http
*       scheme: bearer
*       bearerFormat: JWT
*   schemas:
*     CreateScoreRequestDto:
*       type: object
*       properties:
*         boroughId:
*           type: string
*           format: uuid
*         postcodeId:
*           type: string
*         name:
*           type: string
*         description:
*           type: string
*     ScorePreviewDto:
*       type: object
*       properties:
*         boroughId:
*           type: string
*           format: uuid
*         postcodeId:
*           type: string
*     ScoreReport:
*       type: object
*       properties:
*         scoreReportId:
*           type: string
*           format: uuid
*         boroughId:
*           type: string
*           format: uuid
*         postcodeId:
*           type: string
*         name:
*           type: string
*         description:
*           type: string
*         status:
*           type: string
*           enum: [WAITING, GENERATING, READY, FAILED]
*         overallScore:
*           type: number
*         boroughScore:
*           type: number
*         postcodeScore:
*           type: number
*         scoreBreakdown:
*           type: object
*           additionalProperties:
*             type: number
*         reportData:
*           type: object
*           additionalProperties: true
*         failureReason:
*           type: string
*         createdAt:
*           type: string
*           format: date-time
*         updatedAt:
*           type: string
*           format: date-time
*     ApiResponse:
*       type: object
*       properties:
*         success:
*           type: boolean
*         statusCode:
*           type: number
*         message:
*           type: string
*         data:
*           type: object
*         error:
*           type: string
*     ScoreReportPreview:
*       type: object
*       properties:
*         borough:
*           type: string
*         postcode:
*           type: string
*         overallScore:
*           type: number
*         boroughScore:
*           type: number
*         postcodeScore:
*           type: number
*         scoreBreakdown:
*           type: object
*           additionalProperties:
*             type: object
*         preview:
*           type: object
*           additionalProperties:
*             type: object
*/
const router$4 = Router();
/**
* @swagger
* /score-reports:
*   post:
*     summary: Create a score report request
*     tags: [ScoreReports]
*     security:
*       - bearerAuth: []
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/CreateScoreRequestDto'
*     responses:
*       201:
*         description: Score report request created successfully
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ApiResponse'
*       400:
*         description: Validation error
*/
router$4.post("/", authenticate, validateRequest({ body: CreateScoreRequestDto }), createScoreReport);
/**
* @swagger
* /score-reports/preview:
*   post:
*     summary: Preview a score report
*     tags: [ScoreReports]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/ScorePreviewDto'
*     responses:
*       200:
*         description: Score report preview generated successfully
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ApiResponse'
*       400:
*         description: Validation error
*/
router$4.post("/preview", validateRequest({ body: ScorePreviewDto }), previewScoreReport);
router$4.get("/mine", authenticate, listMyScoreReports);
router$4.delete("/:id", authenticate, deleteMyScoreReport);
/**
* @swagger
* /score-reports/{id}:
*   get:
*     summary: Get a score report by ID
*     tags: [ScoreReports]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: Score report fetched successfully
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ApiResponse'
*       404:
*         description: Score report not found
*/
router$4.get("/:id", authenticate, getScoreReport);
/**
* @swagger
* /score-reports/{id}/generate:
*   post:
*     summary: Start generating a score report
*     tags: [ScoreReports]
*     security:
*       - bearerAuth: []
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       202:
*         description: Score report generation started
*       404:
*         description: Score report not found
*/
router$4.post("/:id/generate", authenticate, enqueueScoreReportGeneration);
/**
* @swagger
* /score-reports/{id}/pdf:
*   get:
*     summary: Download the generated score report PDF
*     tags: [ScoreReports]
*     security:
*       - bearerAuth: []
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: string
*     responses:
*       200:
*         description: PDF file returned successfully
*         content:
*           application/pdf:
*             schema:
*               type: string
*               format: binary
*       400:
*         description: Score report must be READY before PDF generation
*       404:
*         description: Score report not found
*/
router$4.get("/:id/pdf", authenticate, getScoreReportPdf);

//#endregion
//#region src/controllers/analytics.controller.ts
const analyticsEventSchema = z.object({
	eventName: z.literal("page_view"),
	anonymousId: z.string().uuid(),
	path: z.string().trim().min(1).max(2048),
	referrer: z.string().trim().max(2048).optional()
});
const createEvent = async (req, res) => {
	const parsedEvent = analyticsEventSchema.safeParse(req.body);
	if (!parsedEvent.success) {
		res.status(400).json({
			success: false,
			statusCode: 400,
			error: "Invalid analytics event"
		});
		return;
	}
	await prisma.analyticsEvent.create({ data: parsedEvent.data });
	res.status(201).json({
		success: true,
		statusCode: 201,
		data: null,
		message: "Analytics event recorded"
	});
};

//#endregion
//#region src/routes/analytics.routes.ts
const router$3 = Router();
router$3.post("/events", createEvent);

//#endregion
//#region src/controllers/payment.controller.ts
const createCheckout = async (req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await createCheckout$1(req.params.reportId, req.user.userId),
		message: "Checkout session created"
	};
	res.status(200).json(response);
};
const getOrderHistory = async (req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await getOrderHistory$1(req.user.userId),
		message: "Order history fetched successfully"
	};
	res.status(200).json(response);
};
const handleWebhook = async (req, res) => {
	const signature = req.headers["stripe-signature"];
	const value = Array.isArray(signature) ? signature[0] : signature;
	const data = await handleWebhook$1(req.body, value ?? "");
	res.status(200).json(data);
};
const webhookStatus = async (_req, res) => {
	res.status(200).json({
		success: true,
		statusCode: 200,
		message: "Stripe webhook endpoint is ready; send Stripe events with POST"
	});
};
const createSubscriptionCheckout = async (req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await createSubscriptionCheckout$1(req.user.userId),
		message: "Subscription checkout created"
	};
	res.status(200).json(response);
};
const getBilling = async (req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await getBilling$1(req.user.userId),
		message: "Billing status fetched successfully"
	};
	res.status(200).json(response);
};
const confirmCheckout = async (req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await confirmCheckout$1(req.params.sessionId, req.user.userId),
		message: "Checkout status fetched successfully"
	};
	res.status(200).json(response);
};

//#endregion
//#region src/routes/payment.routes.ts
const router$2 = Router();
router$2.get("/orders", authenticate, getOrderHistory);
router$2.get("/checkout/:sessionId", authenticate, confirmCheckout);
router$2.get("/billing", authenticate, getBilling);
router$2.post("/subscription/checkout", authenticate, createSubscriptionCheckout);
router$2.post("/reports/:reportId/checkout", authenticate, createCheckout);

//#endregion
//#region src/repositories/admin.repository.ts
const count = async (query) => {
	const result = await query;
	const row = Array.isArray(result) ? result[0] : result;
	return Number(row?.count ?? 0n);
};
const getAdminOverview = async () => {
	const [totalUsers, activeUsers, unverifiedUsers, totalReports, waitingReports, generatingReports, readyReports, failedReports, totalOrders, pendingOrders, paidOrders, failedOrders, cancelledOrders, recentFailures] = await Promise.all([
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM users`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM users WHERE is_active = true`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM users WHERE is_email_verified = false`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM score_reports`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM score_reports WHERE status = 'WAITING'`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM score_reports WHERE status = 'GENERATING'`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM score_reports WHERE status = 'READY'`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM score_reports WHERE status = 'FAILED'`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM report_orders`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM report_orders WHERE status = 'PENDING'`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM report_orders WHERE status = 'PAID'`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM report_orders WHERE status = 'FAILED'`),
		count(prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM report_orders WHERE status = 'CANCELLED'`),
		prisma.$queryRaw`
      SELECT 'REPORT' AS kind, score_report_id AS id, status::text, NULL::text AS reason, created_at AS "createdAt"
      FROM score_reports
      WHERE status = 'FAILED'
      UNION ALL
      SELECT 'PAYMENT' AS kind, order_id::text AS id, status::text, NULL AS reason, created_at AS "createdAt"
      FROM report_orders
      WHERE status = 'FAILED'
      ORDER BY "createdAt" DESC
      LIMIT 10
    `
	]);
	return {
		users: {
			total: totalUsers,
			active: activeUsers,
			unverified: unverifiedUsers
		},
		reports: {
			total: totalReports,
			waiting: waitingReports,
			generating: generatingReports,
			ready: readyReports,
			failed: failedReports
		},
		orders: {
			total: totalOrders,
			pending: pendingOrders,
			paid: paidOrders,
			failed: failedOrders,
			cancelled: cancelledOrders
		},
		recentFailures
	};
};
const getAdminUsers = async () => {
	return prisma.$queryRaw`
    SELECT u.user_id AS "userId", u.first_name AS "firstName", u.last_name AS "lastName",
      u.email, u.is_active AS "isActive",
      CASE WHEN bs.billing_subscription_id IS NULL THEN NULL ELSE json_build_object(
        'status', bs.status::text,
        'cancelAtPeriodEnd', bs.cancel_at_period_end
      ) END AS subscription
    FROM users u
    LEFT JOIN billing_subscriptions bs ON bs.user_id = u.user_id
    ORDER BY u.created_at DESC
  `;
};
const setUserActive = async (userId, isActive) => {
	return (await prisma.$queryRaw`
    UPDATE users
    SET is_active = ${isActive}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}::uuid
    RETURNING user_id AS "userId", is_active AS "isActive"
  `)[0] ?? null;
};

//#endregion
//#region src/controllers/admin.controller.ts
const getOverview = async (_req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await getAdminOverview(),
		message: "Administrative overview fetched successfully"
	};
	res.status(200).json(response);
};
const getUsers = async (_req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await getAdminUsers(),
		message: "Administrative users fetched successfully"
	};
	res.status(200).json(response);
};
const cancelUserSubscription = async (req, res) => {
	const response = {
		success: true,
		statusCode: 200,
		data: await cancelSubscriptionAtPeriodEnd(String(req.params.userId)),
		message: "Subscription cancellation scheduled successfully"
	};
	res.status(200).json(response);
};
const toggleUserBan = async (req, res) => {
	const isActive = req.body.isActive === true;
	const response = {
		success: true,
		statusCode: 200,
		data: await setUserActive(String(req.params.userId), isActive),
		message: isActive ? "User unbanned successfully" : "User banned successfully"
	};
	res.status(200).json(response);
};

//#endregion
//#region src/routes/admin.routes.ts
const router$1 = Router();
router$1.get("/overview", authenticate, authorize("view:users:all"), getOverview);
router$1.get("/users", authenticate, authorize("view:users:all"), getUsers);
router$1.post("/users/:userId/cancel-subscription", authenticate, authorize("manage:users"), cancelUserSubscription);
router$1.patch("/users/:userId/ban", authenticate, authorize("manage:users"), toggleUserBan);

//#endregion
//#region src/routes/index.ts
const router = Router();
router.use("/reviews", router$31);
router.use("/users", router$30);
router.use("/properties", router$29);
router.use("/auth", router$28);
router.use("/sso", router$27);
router.use("/boroughs", router$26);
router.use("/postcodes", router$25);
router.use("/saved-properties", router$24);
router.use("/experiences", router$23);
router.use("/blog/categories", router$22);
router.use("/blog/tags", router$21);
router.use("/blog/posts", router$20);
router.use("/newsletter", router$19);
router.use("/contact-inquiries", router$18);
router.use("/agencies", router$17);
router.use("/user-credits", router$16);
router.use("/credits", router$15);
router.use("/local-plans", router$14);
router.use("/downloads", router$13);
router.use("/valuations", router$12);
router.use("/ai-interactions", router$11);
router.use("/data/rent", router$10);
router.use("/data/property-values", router$9);
router.use("/data/demography", router$8);
router.use("/data/crime", router$7);
router.use("/data/voting", router$6);
router.use("/data/postcode", router$5);
router.use("/score-reports", router$4);
router.use("/payments", router$2);
router.use("/admin", router$1);
router.use("/analytics", router$3);
router.use(notFoundHandler);
router.use(errorHandler);

//#endregion
//#region src/utils/sso.login.ts
/**
* sso.login.ts
*
* Configures Passport.js strategies for Google OAuth 2.0 and Facebook OAuth.
* Session-less design: Passport verifies the OAuth identity, then we issue
* our own JWT access/refresh tokens (same envelope as the regular loginUser flow).
*
* Exported:
*   configurePassport(app) — registers both strategies on the Express app.
*   SsoTokenPayload         — the shape attached to req.user after a successful OAuth callback.
*/
const logContext = {
	service: "SsoLogin",
	function: ""
};
function configureGoogleStrategy() {
	logContext.function = "configureGoogleStrategy";
	passport.use(new Strategy({
		clientID: config.googleClientId,
		clientSecret: config.googleClientSecret,
		callbackURL: config.googleCallbackUrl,
		scope: ["profile", "email"]
	}, async (_accessToken, _refreshToken, profile, done) => {
		try {
			const email = profile.emails?.[0]?.value;
			if (!email) return done(/* @__PURE__ */ new Error("No email returned from Google"), void 0);
			const { user, session } = await loginOrRegisterSsoUser({
				provider: "google",
				id: profile.id,
				email,
				firstName: profile.name?.givenName ?? profile.displayName,
				lastName: profile.name?.familyName ?? ""
			});
			return done(null, {
				userId: user.userId,
				email: user.email,
				role: user.role,
				accessToken: session.accessToken,
				refreshToken: session.refreshToken
			});
		} catch (err) {
			logger.error(logContext, "Google SSO strategy error", { error: err });
			return done(err, void 0);
		}
	}));
}
function configureFacebookStrategy() {
	logContext.function = "configureFacebookStrategy";
	passport.use(new Strategy$1({
		clientID: config.facebookAppId,
		clientSecret: config.facebookAppSecret,
		callbackURL: config.facebookCallbackUrl,
		profileFields: [
			"id",
			"emails",
			"name"
		]
	}, async (_accessToken, _refreshToken, profile, done) => {
		try {
			const email = profile.emails?.[0]?.value;
			if (!email) return done(/* @__PURE__ */ new Error("No email returned from Facebook"), void 0);
			const { user, session } = await loginOrRegisterSsoUser({
				provider: "facebook",
				id: profile.id,
				email,
				firstName: profile.name?.givenName ?? profile.displayName,
				lastName: profile.name?.familyName ?? ""
			});
			return done(null, {
				userId: user.userId,
				email: user.email,
				role: user.role,
				accessToken: session.accessToken,
				refreshToken: session.refreshToken
			});
		} catch (err) {
			logger.error(logContext, "Facebook SSO strategy error", { error: err });
			return done(err, void 0);
		}
	}));
}
/**
* Registers Google and Facebook Passport strategies on the Express application.
* Must be called once during app bootstrap, after express.json() middleware.
* Session support is intentionally disabled — tokens are issued via JWT.
*/
function configurePassport(app) {
	passport.serializeUser((user, done) => done(null, user));
	passport.deserializeUser((user, done) => done(null, user));
	config.enableGoogleSSO && configureGoogleStrategy();
	config.enableFacebookSSO && configureFacebookStrategy();
	app.use(passport.initialize());
	logger.info({
		service: "SsoLogin",
		function: "configurePassport"
	}, "Passport SSO strategies registered (Google, Facebook)");
}

//#endregion
//#region src/index.ts
dotenv.config();
const app = express();
const PORT = process.env.PORT ?? 5e3;
const isTestProcess = process.env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT !== void 0 || process.argv.includes("--test");
if (!isTestProcess) startScoreReportWorker();
app.use(assignRequestId());
app.use(helmet());
app.use(cors());
app.use(morgan(getCustomMorganFormat));
app.get("/api/v1/payments/webhook", webhookStatus);
app.post("/api/v1/payments/webhook", express.raw({ type: "application/json" }), handleWebhook);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
configurePassport(app);
app.use("/api/v1", router);
app.get("/health", (_req, res) => {
	res.status(200).json({
		status: "ok",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
});
app.get("/", (_req, res) => {
	res.status(200).json({
		status: "ok",
		message: "RoomReview backend is running"
	});
});
app.use(notFoundHandler);
app.use(errorHandler);
if (!isTestProcess) app.listen(PORT, () => {
	logger.info({
		service: "HTTP",
		function: "listen"
	}, `Server running on port ${PORT}`);
});

//#endregion
export { app as default };
//# sourceMappingURL=index.mjs.map