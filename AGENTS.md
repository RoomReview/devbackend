# AGENTS.md — RoomReview Backend Agent Rules

This file defines standing rules for AI agents working in this repository.  
Read this before generating any code. These rules override generic defaults.

---

## 1. Module System — ESM Only

The project is `"type": "module"`. Never generate `require()`, `module.exports`, or `import x = require(...)`.

In test files, import using the `.ts` extension explicitly — `tsx` resolves them directly:
```ts
import { myFn } from './my-service.ts'; // ✅
import { myFn } from './my-service';    // ❌ will break under tsx test runner
```

---

## 2. Path Aliases — Always Prefer Over Relative Paths

Use the aliases defined in `tsconfig.json`. Never write `../../` chains when an alias exists.

| Alias | Resolves to |
|---|---|
| `@/*` | `src/*` |
| `@config/*` | `src/config/*` |
| `@controllers/*` | `src/controllers/*` |
| `@middleware/*` | `src/middleware/*` |
| `@services/*` | `src/services/*` |
| `@utils/*` | `src/utils/*` |
| `@dto/*` | `src/dto/*` |
| `@/generated/prisma/*` | `src/generated/prisma/*` |

> Note: `@routes/*` is in `tsconfig` but routes currently use relative imports — preserve that as-is.

---

## 3. Express 5 — No `try/catch` in Controllers

Express 5 auto-catches rejected async promises and forwards them to the error handler. Do **not** wrap controller logic in `try/catch` unless you need to log before re-throwing.

```ts
// ✅ Correct — Express 5 handles the rejection
export const getUser = async (req: Request, res: Response): Promise<void> => {
  const data = await userService.getById(req.params.id);
  res.status(200).json({ success: true, statusCode: 200, data });
};

// ❌ Wrong — swallows errors and bypasses ApiResponse + errorHandler
export const getUser = async (req: Request, res: Response): Promise<void> => {
  try { ... } catch { res.status(500).json({ error: 'Internal server error' }); }
};
```

When logging is needed, catch → log → re-throw (see `auth.controller.ts`).

---

## 4. Always Use the `ApiResponse` Envelope

Every successful HTTP response must use `ApiResponse<T>` from `src/types/index.ts`. Never return bare objects.

```ts
import type { ApiResponse } from '@/types';

const response: ApiResponse<typeof data> = { success: true, statusCode: 201, data, message: '...' };
res.status(201).json(response);
```

---

## 5. Error Handling — `CustomError` Subclasses Only

Never `throw new Error(...)`. Use the typed subclasses from `src/utils/custom-error.ts`:

| Class | HTTP Status | When |
|---|---|---|
| `EntityNotFoundError` | 404 | Record not found |
| `ValidationError` | 400 | Bad input |
| `InternalServerError` | 500 | Unexpected failure |
| `RouteNotFoundError` | 404 | Used by `notFoundHandler` only |

Constructor: `{ message: string, code: ErrorCode, data?: unknown }`

---

## 6. Zod v4 Import Style

The project uses **Zod v4**. Never use the `z` default import.

```ts
// ✅ Zod v4
import { object, string, email, regexes, enum as enum_, type infer as _infer } from 'zod';

// ❌ Zod v3 style — wrong
import { z } from 'zod';
```

---

## 7. Prisma — Schema Conventions

When adding a model, follow the `User` model pattern:
- PK: `@id @default(uuid(7)) @db.Uuid`
- All fields: `@map("snake_case")`
- Table: `@@map("plural_snake_case")`
- Always include `createdAt DateTime @default(now()) @map("created_at")` and `updatedAt DateTime @updatedAt @map("updated_at")`

**Never run `prisma migrate` or `prisma generate`** in response to schema changes — that is a deliberate human-controlled step.

---

## 8. Prisma — Singleton Client Only

Never instantiate `new PrismaClient()`. Always import the singleton:
```ts
import prisma from '@config/database';
```
The singleton uses the `PrismaPg` adapter. A second instance leaks connections.

---

## 9. Logging — Use the Project Logger

Never use bare `console.log/error`. Use `src/utils/logger.ts`:

```ts
import logger, { LogContext } from '@/utils/logger';

const logContext: LogContext = { service: 'MyService', function: 'myFunction' };
logger.info(logContext, 'Message', { extra });
logger.error(logContext, 'Failed', { error });
```

---

## 10. Validation Middleware — Correct Signature

Pass DTO schemas (not instances) to `validateRequest`. Supports `body`, `params`, `query`:
```ts
router.post('/', validateRequest({ body: CreateThingDto }), controller.create);
```
After `validateRequest`, `req.body` is already parsed — do not re-validate in the service.

---

## 11. Tests — Native Node.js Runner Only

No Jest, no Vitest. Use `node:test` + `node:assert` only. Run with `npm test`.

```ts
import assert from 'node:assert';           // or: import { equal, ok } from 'node:assert'
import { describe, it, test } from 'node:test';
import { myFn } from './my-file.ts';        // .ts extension required

describe('module.name', () => {
  it('should ...', () => { ... });
});
```

Test files must match the `**/*test.ts` glob in `package.json`.

---

## 12. Route Versioning — Match Existing Patterns

Auth routes use full paths (`/v1/auth/register`). Other resource routes (`/users`, `/properties`) do not include `/v1` at the route-file level. **Do not silently add or remove versioning** — match the existing pattern for the resource, or ask.
