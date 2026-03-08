# RoomReview — Backend API

> A RESTful backend API for the RoomReview platform, built with **Express.js 5**, **TypeScript**, and **Prisma ORM** on a PostgreSQL database.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Variables](#environment-variables)
5. [Running Locally](#running-locally)
6. [Scripts](#scripts)
7. [Folder Structure](#folder-structure)
8. [API Endpoints](#api-endpoints)
9. [Error Handling](#error-handling)

---

## Overview

RoomReview Backend is a dedicated TypeScript/Express.js service that exposes a JSON REST API consumed by the RoomReview frontend. Key characteristics:

- **Express 5** — latest release with first-class async error propagation.
- **Prisma 7 + `@prisma/adapter-pg`** — type-safe database access with native PostgreSQL driver via `pg`.
- **Zod** — request body validation enforced at the middleware layer.
- **Helmet + CORS** — hardened HTTP headers and configurable cross-origin policy.
- **Morgan + `uuid`-stamped request IDs** — structured HTTP access logging with per-request traceability.
- **`tsdown`** — fast, opinionated bundler for producing ESM and CJS distribution artefacts.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | `>= 20.0.0` |
| npm | `>= 10` (bundled with Node 20) |
| PostgreSQL | `>= 14` |

---

## Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd devbackend

# 2. Install dependencies
npm install

# 3. Copy and configure the environment file
cp .env.example .env
# Edit .env with your actual values (see Environment Variables below)

# 4. Generate the Prisma client
npx prisma generate

# 5. Apply database migrations (development)
npx prisma migrate dev
```

---

## Environment Variables

Copy `.env.example` to `.env` and populate every variable before starting the server.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Port the HTTP server binds to. |
| `NODE_ENV` | Yes | `development` | Runtime environment. Set to `production` in deployed environments. Affects error verbosity. |
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string. Format: `postgresql://user:password@host:port/db?schema=public` |
| `JWT_SECRET` | Yes | — | Secret key used to sign and verify JSON Web Tokens. Must be a long, random, high-entropy string. |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiry duration in [Zeit/ms](https://github.com/vercel/ms) format (e.g. `7d`, `1h`). |
| `CORS_ORIGIN` | Yes | — | Allowed CORS origin for the frontend client (e.g. `http://localhost:3000`). |

---

## Running Locally

```bash
# Start the development server with hot-reload (tsx watch)
npm run dev
```

The server starts at `http://localhost:<PORT>` (default `5000`).

A health-check endpoint is always available at:

```
GET /health
→ 200 { "status": "ok", "timestamp": "..." }
```

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Start dev server with file-watching and hot-reload. |
| `build:dev` | `tsc && tsdown` | Type-check then bundle for development artefacts. |
| `build:prod` | `tsc && tsdown` | Type-check then bundle for production. |
| `start` | `node dist/index.mjs` | Run the compiled ESM bundle (after build). |
| `start:cjs` | `node dist/index.cjs` | Run the compiled CJS bundle (after build). |
| `lint` | `eslint src/** --concurrency auto --cache` | Lint source files (cached for speed). |
| `lint:fix` | `eslint src/** --fix` | Lint and auto-fix fixable issues. |
| `format` | `prettier --write "src/**/*.ts"` | Format all TypeScript source files with Prettier. |
| `test` | `tsx --experimental-test-coverage --test **/*test.ts` | Run all test files with Node's built-in test runner and coverage. |
| `test:watch` | `tsx --experimental-test-coverage --watch --test **/*test.ts` | Run tests in watch mode. |

---

## Folder Structure

```
devbackend/
├── prisma/                     # Prisma schema and migration history
│   └── schema.prisma
├── src/
│   ├── index.ts                # Application entry point; registers middleware and mounts routes
│   ├── config/
│   │   ├── database.ts         # Prisma client singleton (PgAdapter + pg Pool)
│   │   └── index.ts            # Aggregated config exports (env validation, etc.)
│   ├── routes/
│   │   ├── index.ts            # Root router; mounts resource sub-routers under /api
│   │   ├── auth.routes.ts      # Authentication routes (register, login)
│   │   ├── user.routes.ts      # User CRUD routes
│   │   ├── property.routes.ts  # Property CRUD routes
│   │   └── review.routes.ts    # Review CRUD routes
│   ├── controllers/
│   │   ├── auth.controller.ts  # Handles auth request/response lifecycle
│   │   ├── user.controller.ts  # Handles user request/response lifecycle
│   │   ├── property.controller.ts
│   │   └── review.controller.ts
│   ├── services/
│   │   ├── auth.service.ts     # Authentication business logic (register, login)
│   │   ├── password.service.ts # Password hashing and comparison
│   │   ├── token.service.ts    # JWT sign/verify helpers
│   │   ├── user.service.ts     # User business logic
│   │   ├── property.service.ts # Property business logic
│   │   └── review.service.ts   # Review business logic
│   ├── repositories/
│   │   ├── users.repository.ts     # Data-access layer for the users table
│   │   └── sessions.repository.ts  # Data-access layer for sessions
│   ├── middleware/
│   │   ├── auth.middleware.ts          # JWT authentication guard
│   │   ├── error.middleware.ts         # Centralised error handler + 404 handler
│   │   ├── request-id.middleware.ts    # Attaches a unique UUID to every request
│   │   ├── request-logger.middleware.ts# Custom Morgan token / format configuration
│   │   └── validation.middleware.ts    # Zod schema validation wrapper
│   ├── dto/
│   │   └── auth.dto.ts         # Zod schemas (RegisterUserDto, LoginUserDto)
│   ├── types/
│   │   └── index.ts            # Shared TypeScript interfaces (ApiResponse, etc.)
│   ├── utils/
│   │   ├── custom-error.ts     # Typed error classes (CustomError hierarchy)
│   │   ├── helpers.ts          # General-purpose utility functions
│   │   └── logger.ts           # Application logger configuration
│   └── generated/              # Prisma auto-generated client artefacts (do not edit)
├── .env.example                # Environment variable template
├── .prettierrc                 # Prettier formatting config
├── eslint.config.ts            # ESLint flat config
├── tsconfig.json               # TypeScript compiler options
├── tsdown.config.ts            # tsdown bundler config
├── prisma.config.ts            # Prisma config override
└── package.json
```

---

## API Endpoints

All routes are mounted under the `/api` prefix.

> **Note:** The `/auth/*` router is currently commented out in `routes/index.ts` and is not active. The auth route definitions are present and can be enabled when authentication is wired up end-to-end.

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Liveness check — returns server status and timestamp. |

### Reviews `/api/reviews`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/reviews` | — | Retrieve all reviews. |
| `GET` | `/api/reviews/:id` | — | Retrieve a single review by ID. |
| `POST` | `/api/reviews` | — | Create a new review. |
| `PUT` | `/api/reviews/:id` | — | Update an existing review by ID. |
| `DELETE` | `/api/reviews/:id` | — | Delete a review by ID. |

### Users `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | — | Retrieve all users. |
| `GET` | `/api/users/:id` | — | Retrieve a single user by ID. |
| `POST` | `/api/users` | — | Create a new user. |
| `PUT` | `/api/users/:id` | — | Update an existing user by ID. |
| `DELETE` | `/api/users/:id` | — | Delete a user by ID. |

### Properties `/api/properties`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/properties` | — | Retrieve all properties. |
| `GET` | `/api/properties/:id` | — | Retrieve a single property by ID. |
| `POST` | `/api/properties` | — | Create a new property. |
| `PUT` | `/api/properties/:id` | — | Update an existing property by ID. |
| `DELETE` | `/api/properties/:id` | — | Delete a property by ID. |

### Auth *(inactive — pending integration)*

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/v1/auth/register` | None | Register a new user account. Body validated via `RegisterUserDto`. |
| `POST` | `/api/auth/v1/auth/login` | None | Authenticate and receive a JWT. Body validated via `LoginUserDto`. |

---

## Error Handling

All errors are normalised into a consistent `ApiResponse` JSON envelope by the centralised `errorHandler` middleware:

```jsonc
{
  "success": false,
  "message": "Human-readable error description",
  "statusCode": 404,
  "status": "error",
  "error": "ENTITY_NOT_FOUND",   // machine-readable error code (CustomError instances only)
  "data": null
}
```

### Error Class Hierarchy

| Class | HTTP Status | Code |
|---|---|---|
| `EntityNotFoundError` | `404` | `ENTITY_NOT_FOUND` |
| `RouteNotFoundError` | `404` | `ROUTE_NOT_FOUND` |
| `ValidationError` | `400` | `VALIDATION_ERROR` |
| `InternalServerError` | `500` | `INTERNAL_SERVER_ERROR` |
| Unhandled `Error` | `500` | *(stack trace included in `development` only)* |

Throw any `CustomError` subclass from a service or controller — the error handler middleware will catch it automatically (Express 5's native async error propagation means no `try/catch` wrappers or `next(err)` calls are needed in async route handlers).

### 404 Not Found

Unmatched routes are caught by `notFoundHandler` and forwarded to `errorHandler` with a `RouteNotFoundError`, ensuring every unknown path returns a structured JSON response rather than Express's default HTML fallback.
