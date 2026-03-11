# RoomReview — Backend API

> A RESTful backend API for the **RoomReview** platform, built with **Express.js 5**, **TypeScript**, and **Prisma ORM** on PostgreSQL.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture & Request Lifecycle](#architecture--request-lifecycle)
   - [Middleware Stack](#middleware-stack)
   - [Request Flow Diagram](#request-flow-diagram)
   - [Layer Responsibilities](#layer-responsibilities)
4. [Data Models & Repository Layer](#data-models--repository-layer)
5. [Prerequisites](#prerequisites)
6. [Installation](#installation)
7. [Environment Variables](#environment-variables)
8. [Running Locally](#running-locally)
9. [Scripts](#scripts)
10. [Folder Structure](#folder-structure)
11. [API Endpoints](#api-endpoints)
12. [Error Handling](#error-handling)
13. [Contributor Guide — Adding a New Endpoint](#contributor-guide--adding-a-new-endpoint)

---

## Overview

RoomReview Backend is a dedicated TypeScript/Express.js service that exposes a JSON REST API consumed by the RoomReview frontend. It is designed around strict separation of concerns:

- **Routes** declare URL patterns and attach middleware.
- **Controllers** own the HTTP request/response lifecycle.
- **Services** hold all business logic — no HTTP concerns here.
- **Repositories** are the **only** code that touches Prisma/the database.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20, ESM (`"type": "module"`) |
| Framework | **Express 5** — native async error propagation, no `try/catch` wrappers needed |
| Language | **TypeScript** — strict mode, ESM imports |
| ORM / DB | **Prisma 7** + `@prisma/adapter-pg` + native `pg` Pool on **PostgreSQL ≥ 14** |
| Validation | **Zod v4** — enforced at the middleware layer via `validateRequest` |
| Auth | JWT (access + refresh tokens), RBAC via `permissions` config |
| Security | **Helmet** (hardened headers) + configurable **CORS** |
| Logging | **Morgan** + `pino` — every request gets a UUID-stamped `X-Request-ID` |
| Bundler | **`tsdown`** — produces both ESM and CJS distribution artefacts |
| Tests | Node.js built-in `node:test` runner + `tsx` |

---

## Architecture & Request Lifecycle

### Middleware Stack

Every HTTP request passes through the following middleware in order, as registered in `src/index.ts`:

| # | Middleware | File | Purpose |
|---|---|---|---|
| 1 | `assignRequestId` | `request-id.middleware.ts` | Attaches a unique `uuid(7)` to `req.id` and sets `X-Request-ID` response header |
| 2 | `helmet()` | (package) | Sets hardened HTTP security headers |
| 3 | `cors()` | (package) | Enforces CORS policy from `CORS_ORIGIN` env var |
| 4 | `morgan(...)` | `request-logger.middleware.ts` | Structured HTTP access logging using the request ID |
| 5 | `express.json()` | (built-in) | Parses `application/json` request bodies |
| 6 | `express.urlencoded()` | (built-in) | Parses URL-encoded form bodies |
| 7 | **Routes** | `routes/index.ts` | Dispatches to resource sub-routers under `/api/v1` |
| — | `authenticate` *(per-route)* | `auth.middleware.ts` | Verifies Bearer JWT; populates `req.user` |
| — | `authorize(...)` *(per-route)* | `auth.middleware.ts` | RBAC role check against `permissions` config |
| — | `validateRequest(...)` *(per-route)* | `validation.middleware.ts` | Zod schema validation for `body`, `params`, `query` |
| — | `notFoundHandler` | `error.middleware.ts` | Catches all unmatched routes → `RouteNotFoundError` |
| — | `errorHandler` | `error.middleware.ts` | Central error normaliser; formats all errors into `ApiResponse` |

### Request Flow Diagram

![request-flow](./assets/req-flow.png)
```mermaid
flowchart TD
    Client(["🌐 HTTP Client"])

    subgraph Global["Global Middleware (every request)"]
        M1["assignRequestId\n— uuid stamp on req + header"]
        M2["helmet\n— security headers"]
        M3["cors\n— origin policy"]
        M4["morgan\n— access log"]
        M5["express.json / urlencoded\n— body parsing"]
    end

    subgraph Router["Route Dispatch  /api/v1/*"]
        R1["routes/index.ts\n— sub-router mounting"]
    end

    subgraph PerRoute["Per-Route Middleware"]
        PR1["authenticate\n— verify JWT → req.user"]
        PR2["authorize(...roles)\n— RBAC permission check"]
        PR3["validateRequest({ body/params/query })\n— Zod schema parse"]
    end

    subgraph AppLayer["Application Layers"]
        C["Controller\n— req/res only, no logic"]
        S["Service\n— business logic, no HTTP"]
        Repo["Repository\n— Prisma queries only"]
        DB[("PostgreSQL")]
    end

    subgraph ErrorPath["Error Path (Express 5 async catch)"]
        EH["errorHandler middleware\n— normalises to ApiResponse"]
    end

    Client -->|HTTP Request| M1
    M1 --> M2 --> M3 --> M4 --> M5 --> R1

    R1 -->|protected route| PR1
    PR1 -->|authorised| PR2
    PR2 -->|valid role| PR3
    PR3 -->|passes| C

    R1 -->|public route| C

    C -->|calls| S
    S -->|calls| Repo
    Repo -->|Prisma query| DB
    DB -->|result| Repo
    Repo -->|entity| S
    S -->|data| C
    C -->|"res.json(ApiResponse)"| Client

    PR1 -->|"throw UnauthorizedError"| EH
    PR2 -->|"throw UnauthorizedError"| EH
    PR3 -->|"throw ValidationError"| EH
    S -->|"throw CustomError"| EH
    EH -->|"JSON error envelope"| Client
```

### Layer Responsibilities

```
HTTP Request
    ↓
[ Route ]          — URL pattern + middleware chain declaration
    ↓
[ Controller ]     — Extract from req, call service, write res. No business logic.
    ↓
[ Service ]        — All domain/business logic. No req/res. No Prisma imports.
    ↓
[ Repository ]     — All database access. Prisma only. Returns typed entities.
    ↓
[ Database ]       — PostgreSQL via Prisma + pg native adapter
```

> **Rule:** Each layer may only call the layer directly below it.  
> Controllers never call repositories. Services never import `res` or `req`.  
> Repositories never contain business logic.

---

## Data Models & Repository Layer

### Current Models (`prisma/schema.prisma`)

| Model | Table | Description |
|---|---|---|
| `User` | `users` | Platform user — email, password hash, role, email-verification state |
| `Session` | `sessions` | Token store — access/refresh token ID + expiry per user |

### Roles (`UserRole` enum)

| Value | Description |
|---|---|
| `TENANT` | Default role — can browse and submit reviews |
| `LANDLORD` | Can manage property listings |
| `ADMIN` | Full platform access |

### Repository Convention

> **Every Prisma model MUST have a corresponding repository file in `src/repositories/`.**

| Model | Repository File |
|---|---|
| `User` | `src/repositories/users.repository.ts` |
| `Session` | `src/repositories/sessions.repository.ts` |
| *future models* | `src/repositories/<plural-model>.repository.ts` |

**Repositories are the single source of truth for database access.**  
Never call `prisma.*` from a service, controller, or any other layer.

```ts
// ✅ Correct — repository wraps all Prisma queries
// src/repositories/users.repository.ts
import prisma from '@config/database';

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email } });

// ❌ Wrong — Prisma called directly in a service
// src/services/auth.service.ts
import prisma from '@config/database';
const user = await prisma.user.findUnique(...); // Never do this
```

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

# 3. Copy and configure environment file
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
| `PORT` | No | `5000` | Port the HTTP server binds to |
| `NODE_ENV` | Yes | `development` | Runtime environment. Affects error verbosity. Set to `production` in deployed environments. |
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string. Format: `postgresql://user:password@host:port/db?schema=public` |
| `JWT_SECRET` | Yes | — | Secret key used to sign and verify JSON Web Tokens. Must be a long, random, high-entropy string. |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiry in [ms](https://github.com/vercel/ms) format (e.g. `7d`, `1h`). |
| `CORS_ORIGIN` | Yes | — | Allowed CORS origin for the frontend client (e.g. `http://localhost:3000`). |

---

## Running Locally

```bash
# Start the development server with hot-reload (tsx watch)
npm run dev
```

Server starts at `http://localhost:<PORT>` (default `5000`).

```
GET /health
→ 200 { "status": "ok", "timestamp": "..." }
```

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Start dev server with hot-reload |
| `build:dev` | `tsc && tsdown` | Type-check + bundle (dev artefacts) |
| `build:prod` | `tsc && tsdown` | Type-check + bundle (production) |
| `start` | `node dist/index.mjs` | Run the compiled ESM bundle |
| `start:cjs` | `node dist/index.cjs` | Run the compiled CJS bundle |
| `lint` | `eslint src/** --concurrency auto --cache` | Lint source files (cached) |
| `lint:fix` | `eslint src/** --fix` | Lint and auto-fix |
| `format` | `prettier --write "src/**/*.ts"` | Format all TypeScript source files |
| `test` | `tsx --experimental-test-coverage --test **/*test.ts` | Run all tests with Node built-in runner + coverage |
| `test:watch` | `tsx --experimental-test-coverage --watch --test **/*test.ts` | Run tests in watch mode |
| `prisma:generate` | `npx prisma generate` | Re-generate the Prisma client after schema changes |
| `prisma:migrate:dev` | `npx prisma migrate dev` | Create + apply a new migration (development) |
| `prisma:migrate:reset` | `npx prisma migrate reset` | Reset DB and re-apply all migrations (dev only) |

---

## Folder Structure

```
devbackend/
├── prisma/
│   ├── schema.prisma               # Data model definitions (source of truth)
│   └── seeds/                      # Database seed scripts
├── scripts/                        # One-off utility scripts
├── src/
│   ├── index.ts                    # App entry: registers global middleware, mounts routes
│   │
│   ├── config/
│   │   ├── database.ts             # Prisma client SINGLETON — import this, never new PrismaClient()
│   │   ├── permissions.ts          # RBAC permission map (role → allowed actions)
│   │   └── index.ts                # Aggregated env config exports
│   │
│   ├── routes/
│   │   ├── index.ts                # Root router — mounts all sub-routers under /api/v1
│   │   ├── auth.routes.ts          # POST /auth/register, /auth/login, /auth/verify-email
│   │   ├── user.routes.ts          # GET/POST/PUT/DELETE /users
│   │   ├── property.routes.ts      # GET/POST/PUT/DELETE /properties
│   │   └── review.routes.ts        # GET/POST/PUT/DELETE /reviews
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts      # HTTP handlers for auth flows
│   │   ├── user.controller.ts      # HTTP handlers for user CRUD
│   │   ├── property.controller.ts  # HTTP handlers for property CRUD
│   │   └── review.controller.ts    # HTTP handlers for review CRUD
│   │
│   ├── services/
│   │   ├── auth.service.ts         # Auth business logic (register, login, email verify)
│   │   ├── jwt.token.service.ts    # JWT sign / verify / refresh helpers
│   │   ├── token.service.ts        # Token store helpers (session management)
│   │   ├── password.service.ts     # bcrypt hash + compare
│   │   ├── user.service.ts         # User domain logic
│   │   ├── property.service.ts     # Property domain logic
│   │   └── review.service.ts       # Review domain logic
│   │
│   ├── repositories/               # ⚠️ ALL Prisma access MUST live here
│   │   ├── users.repository.ts     # Data-access layer for `users` table
│   │   └── sessions.repository.ts  # Data-access layer for `sessions` table
│   │   └── <model>.repository.ts   # Add one per Prisma model — NO EXCEPTIONS
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts          # authenticate() — JWT guard; authorize() — RBAC check
│   │   ├── error.middleware.ts         # errorHandler + notFoundHandler
│   │   ├── request-id.middleware.ts    # assignRequestId — uuid stamp per request
│   │   ├── request-logger.middleware.ts# Morgan format with request ID
│   │   └── validation.middleware.ts    # validateRequest() — Zod body/params/query validation
│   │
│   ├── dto/
│   │   └── auth.dto.ts             # Zod schemas: RegisterUserDto, LoginUserDto
│   │
│   ├── types/
│   │   └── index.ts                # Shared TS types: ApiResponse<T>, AuthenticatedRequest, etc.
│   │
│   ├── utils/
│   │   ├── custom-error.ts         # CustomError class hierarchy
│   │   ├── helpers.ts              # General-purpose utility functions
│   │   └── logger.ts               # pino logger + LogContext helper
│   │
│   └── generated/                  # ⛔ Prisma-generated client — DO NOT EDIT
│
├── .env.example                    # Environment variable template
├── AGENTS.md                       # AI agent coding rules for this repo
├── .prettierrc                     # Prettier config
├── eslint.config.ts                # ESLint flat config
├── tsconfig.json                   # TypeScript compiler options + path aliases
├── tsdown.config.ts                # tsdown bundler config (ESM + CJS output)
├── prisma.config.ts                # Prisma config override
└── package.json
```

---

## API Endpoints

All routes are mounted under `/api/v1`.

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Liveness check — returns server status and timestamp |

### Auth `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | None | Register a new user. Body validated via `RegisterUserDto`. Sends email verification code. |
| `POST` | `/api/v1/auth/login` | None | Authenticate and receive access + refresh JWTs. Body validated via `LoginUserDto`. |
| `POST` | `/api/v1/auth/resend-verification` | None | Resend email verification code. |
| `GET` | `/api/v1/auth/verify-email` | None | Verify the emailed code and mark account as verified. |

### Users `/api/v1/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/users` | 🔒 JWT | Retrieve all users |
| `GET` | `/api/v1/users/:id` | 🔒 JWT | Retrieve a single user by ID |
| `POST` | `/api/v1/users` | 🔒 JWT | Create a new user |
| `PUT` | `/api/v1/users/:id` | 🔒 JWT | Update an existing user by ID |
| `DELETE` | `/api/v1/users/:id` | 🔒 JWT | Delete a user by ID |

### Properties `/api/v1/properties`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/properties` | — | Retrieve all properties |
| `GET` | `/api/v1/properties/:id` | — | Retrieve a single property by ID |
| `POST` | `/api/v1/properties` | 🔒 JWT | Create a new property listing |
| `PUT` | `/api/v1/properties/:id` | 🔒 JWT | Update an existing property by ID |
| `DELETE` | `/api/v1/properties/:id` | 🔒 JWT | Delete a property by ID |

### Reviews `/api/v1/reviews`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/reviews` | — | Retrieve all reviews |
| `GET` | `/api/v1/reviews/:id` | — | Retrieve a single review by ID |
| `POST` | `/api/v1/reviews` | 🔒 JWT | Submit a new review |
| `PUT` | `/api/v1/reviews/:id` | 🔒 JWT | Update an existing review by ID |
| `DELETE` | `/api/v1/reviews/:id` | 🔒 JWT | Delete a review by ID |

---

## Error Handling

All errors are normalised into a consistent `ApiResponse` JSON envelope by the centralised `errorHandler` middleware:

```jsonc
{
  "success": false,
  "message": "Human-readable error description",
  "statusCode": 404,
  "status": "error",
  "error": "ENTITY_NOT_FOUND",  // machine-readable code (CustomError instances only)
  "data": null
}
```

### Error Class Hierarchy (`src/utils/custom-error.ts`)

| Class | HTTP | Code | When to Use |
|---|---|---|---|
| `EntityNotFoundError` | `404` | `ENTITY_NOT_FOUND` | Record does not exist in the DB |
| `RouteNotFoundError` | `404` | `ROUTE_NOT_FOUND` | Used by `notFoundHandler` only — do not use directly |
| `ValidationError` | `400` | `VALIDATION_ERROR` | Bad or missing input parameters |
| `UnauthorizedError` | `401` | `UNAUTHORIZED` | Missing or invalid auth token / insufficient permissions |
| `InternalServerError` | `500` | `INTERNAL_SERVER_ERROR` | Unexpected / unrecoverable failure |
| Unhandled `Error` | `500` | *(stack included in `development` only)* | Last-resort catch-all |

**Never** throw `new Error(...)`. Always use one of the subclasses above.  
**Never** wrap controller logic in `try/catch` — Express 5 forwards rejected async promises to `errorHandler` automatically.

### 404 Not Found

Unmatched routes are caught by `notFoundHandler` and forwarded to `errorHandler` with a `RouteNotFoundError`, ensuring every unknown path returns a structured JSON response rather than Express's default HTML fallback.

---

## Contributor Guide — Adding a New Endpoint

Follow this checklist whenever you add a new resource or endpoint. **No step is optional.**

### Step 1 — Prisma Schema

1. Add your model to `prisma/schema.prisma` following the existing `User` model conventions:
   - PK: `@id @default(uuid(7)) @db.Uuid`
   - All fields: `@map("snake_case")`
   - Table: `@@map("plural_snake_case")`
   - Include `createdAt` and `updatedAt` timestamps
2. **Do not run** `prisma migrate` or `prisma generate` — those are human-controlled steps.

### Step 2 — Repository (mandatory)

Create `src/repositories/<plural-model>.repository.ts`.  
This file is the **only** place in the codebase that may import and call `prisma.*` for this model.

```ts
// src/repositories/things.repository.ts
import prisma from '@config/database';

export const findAllThings  = ()      => prisma.thing.findMany();
export const findThingById  = (id: string) => prisma.thing.findUnique({ where: { thingId: id } });
export const createThing    = (data: Prisma.ThingCreateInput) => prisma.thing.create({ data });
export const updateThingById = (id: string, data: Prisma.ThingUpdateInput) =>
  prisma.thing.update({ where: { thingId: id }, data });
export const deleteThingById = (id: string) => prisma.thing.delete({ where: { thingId: id } });
```

### Step 3 — DTO

Create `src/dto/<model>.dto.ts` with Zod v4 schemas for request validation.

```ts
// src/dto/thing.dto.ts
import { object, string } from 'zod';

export const CreateThingDto = object({ name: string() });
export const UpdateThingDto = object({ name: string() });
```

### Step 4 — Service

Create `src/services/<model>.service.ts`.  
Import from the repository — never from `@config/database` directly.

```ts
// src/services/thing.service.ts
import { findAllThings, createThing, findThingById } from '@repositories/things.repository.ts';
import { EntityNotFoundError } from '@utils/custom-error.ts';
import logger from '@utils/logger.ts';

const logCtx = { service: 'ThingService' };

export const getAllThings = async () => {
  logger.info(logCtx, 'getAllThings');
  return findAllThings();
};

export const getThingById = async (id: string) => {
  const thing = await findThingById(id);
  if (!thing) throw new EntityNotFoundError({ message: 'Thing not found', code: 'ENTITY_NOT_FOUND' });
  return thing;
};
```

### Step 5 — Controller

Create `src/controllers/<model>.controller.ts`.  
No `try/catch`. No business logic. No Prisma imports.

```ts
// src/controllers/thing.controller.ts
import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import { getAllThings } from '@services/thing.service.ts';

export const listThings = async (_req: Request, res: Response): Promise<void> => {
  const data = await getAllThings();
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data };
  res.status(200).json(response);
};
```

### Step 6 — Route

Create `src/routes/<model>.routes.ts` and mount it in `routes/index.ts`.

```ts
// src/routes/thing.routes.ts
import { Router } from 'express';
import { listThings } from '../controllers/thing.controller.ts';
import { authenticate } from '../middleware/auth.middleware.ts';
import { validateRequest } from '../middleware/validation.middleware.ts';
import { CreateThingDto } from '../dto/thing.dto.ts';

const router = Router();
router.get('/',  authenticate, listThings);
router.post('/', authenticate, validateRequest({ body: CreateThingDto }), createThing);
export default router;
```

### Step 7 — Tests

Add test files matching `**/*test.ts` using `node:test` + `node:assert`. Use `.ts` extensions in imports.

### Step 8 — Update README

Add your new routes to the [API Endpoints](#api-endpoints) table above.

---

> **Key architectural reminders for maintainers:**
> - Every Prisma model → one repository file in `src/repositories/`.
> - Services call repositories; controllers call services. Never skip layers.
> - Express 5: async errors propagate automatically — no `try/catch` in controllers.
> - All successful responses use `ApiResponse<T>` from `src/types/index.ts`.
> - All errors use `CustomError` subclasses — never `new Error(...)`.
> - All request validation uses `validateRequest()` middleware with Zod v4 schemas.
> - All logging uses `logger` from `@utils/logger.ts` — never `console.log`.
