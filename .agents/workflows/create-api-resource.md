---
description: Scaffold a complete CRUD API resource for a given entity
---

# Create API Resource Workflow

## Trigger
> "Create a new resource for [EntityName]"

**Variable conventions used throughout this workflow:**
- `[EntityName]` — PascalCase singular (e.g. `Booking`)
- `[entityName]` — camelCase singular (e.g. `booking`)
- `[entity]` — kebab-case singular (e.g. `booking`) — used in **filenames**
- `[entities]` — kebab-case plural (e.g. `bookings`) — used in **route paths** and **Prisma `@@map`**

---

## Step 1 — Database: Prisma Schema

**File:** `prisma/schema.prisma`

Add a new Prisma model following the existing conventions:
- Primary key uses `@id @default(uuid(7))` with `@db.Uuid`
- All column names `@map("snake_case")`
- Table name `@@map("[entities]")` (plural snake_case)
- Always include `createdAt DateTime @default(now()) @map("created_at")` and `updatedAt DateTime @updatedAt @map("updated_at")`

```prisma
model [EntityName] {
  [entityName]Id String   @id @default(uuid(7)) @map("[entity_name]_id") @db.Uuid
  // ... your fields here
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@map("[entities]")
}
```

> **Do NOT run `prisma migrate` or `prisma generate` yet.** Schema changes are committed; migrations are a separate step.

---

## Step 2 — DTOs: Zod Schemas

**File:** `src/dto/[entity].dto.ts`

Use the Zod v4 import style already established in the project:

```typescript
import { object, string, type infer as _infer } from 'zod';

export const Create[EntityName]Dto = object({
  // map each required create-field
  field: string().min(1),
});
export type Create[EntityName]Dto = _infer<typeof Create[EntityName]Dto>;

export const Update[EntityName]Dto = object({
  // partial updates — wrap optional fields
  field: string().min(1).optional(),
});
export type Update[EntityName]Dto = _infer<typeof Update[EntityName]Dto>;
```

- Import enums from `@/generated/prisma/enums` if needed (see `auth.dto.ts` pattern).
- Use `email({ pattern: regexes.email })` for email fields.

---

## Step 3 — Repository: Data Access Layer

**File:** `src/repositories/[entity].repository.ts`

Import the Prisma client singleton from `@config/database` and generated types from `@/generated/prisma/models`:

```typescript
import prisma from '@config/database';
import type { [EntityName]CreateInput, [EntityName]Select } from '@/generated/prisma/models';

export const create[EntityName] = async (data: [EntityName]CreateInput) => {
  return await prisma.[entityName].create({ data });
};

export const findAll[EntityName]s = async () => {
  return await prisma.[entityName].findMany();
};

export const find[EntityName]ById = async (id: string, select?: [EntityName]Select) => {
  return await prisma.[entityName].findUnique({ where: { [entityName]Id: id }, select });
};

export const update[EntityName] = async (id: string, data: Partial<[EntityName]CreateInput>) => {
  return await prisma.[entityName].update({ where: { [entityName]Id: id }, data });
};

export const delete[EntityName] = async (id: string) => {
  return await prisma.[entityName].delete({ where: { [entityName]Id: id } });
};
```

---

## Step 4 — Service: Business Logic

**File:** `src/services/[entity].service.ts`

Import directly from the repository file. Throw `CustomError` subclasses for failure states — never raw `Error` objects. Use `EntityNotFoundError` when a lookup returns `null`.

```typescript
import {
  create[EntityName],
  findAll[EntityName]s,
  find[EntityName]ById,
  update[EntityName],
  delete[EntityName],
} from '@/repositories/[entity].repository';
import { EntityNotFoundError } from '@utils/custom-error';
import type { Create[EntityName]Dto, Update[EntityName]Dto } from '@dto/[entity].dto';

export const getAll[EntityName]s = async () => {
  return await findAll[EntityName]s();
};

export const get[EntityName]ById = async (id: string) => {
  const entity = await find[EntityName]ById(id);
  if (!entity) {
    throw new EntityNotFoundError({ message: `[EntityName] not found`, code: 'ENTITY_NOT_FOUND' });
  }
  return entity;
};

export const createNew[EntityName] = async (data: Create[EntityName]Dto) => {
  return await create[EntityName](data);
};

export const update[EntityName]ById = async (id: string, data: Update[EntityName]Dto) => {
  await get[EntityName]ById(id); // guard: throws 404 if missing
  return await update[EntityName](id, data);
};

export const delete[EntityName]ById = async (id: string) => {
  await get[EntityName]ById(id); // guard: throws 404 if missing
  return await delete[EntityName](id);
};
```

---

## Step 5 — Controller: HTTP Lifecycle

**File:** `src/controllers/[entity].controller.ts`

Controllers use **Express 5 async error propagation** — there is no `try/catch` block. Errors thrown in the service layer bubble up to the `errorHandler` in `error.middleware.ts` automatically.

Responses use the `ApiResponse` envelope from `@/types`.

```typescript
import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as [entityName]Service from '@services/[entity].service';
import type { Create[EntityName]Dto, Update[EntityName]Dto } from '@dto/[entity].dto';

export const getAll[EntityName]s = async (_req: Request, res: Response): Promise<void> => {
  const data = await [entityName]Service.getAll[EntityName]s();
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data };
  res.status(200).json(response);
};

export const get[EntityName]ById = async (req: Request, res: Response): Promise<void> => {
  const data = await [entityName]Service.get[EntityName]ById(req.params.id);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data };
  res.status(200).json(response);
};

export const create[EntityName] = async (req: Request, res: Response): Promise<void> => {
  const data = await [entityName]Service.createNew[EntityName](req.body as Create[EntityName]Dto);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 201, data };
  res.status(201).json(response);
};

export const update[EntityName] = async (req: Request, res: Response): Promise<void> => {
  const data = await [entityName]Service.update[EntityName]ById(req.params.id, req.body as Update[EntityName]Dto);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data };
  res.status(200).json(response);
};

export const delete[EntityName] = async (req: Request, res: Response): Promise<void> => {
  await [entityName]Service.delete[EntityName]ById(req.params.id);
  const response: ApiResponse = { success: true, statusCode: 200, message: '[EntityName] deleted' };
  res.status(200).json(response);
};
```

> No `try/catch` — Express 5 automatically catches rejected async promises and forwards them to the next error handler.

---

## Step 6 — Routes

### 6a. Create the resource router

**File:** `src/routes/[entity].routes.ts`

Apply `validateRequest` from `validation.middleware.ts` for routes that accept a body. Import using the `@controllers/` path alias.

```typescript
import { Router } from 'express';
import * as [entityName]Controller from '@controllers/[entity].controller';
import { validateRequest } from '@middleware/validation.middleware';
import { Create[EntityName]Dto, Update[EntityName]Dto } from '@dto/[entity].dto';

const router = Router();

router.get('/', [entityName]Controller.getAll[EntityName]s);
router.get('/:id', [entityName]Controller.get[EntityName]ById);
router.post('/', validateRequest({ body: Create[EntityName]Dto }), [entityName]Controller.create[EntityName]);
router.put('/:id', validateRequest({ body: Update[EntityName]Dto }), [entityName]Controller.update[EntityName]);
router.delete('/:id', [entityName]Controller.delete[EntityName]);

export default router;
```

### 6b. Mount into the root router

**File:** `src/routes/index.ts`

Add the import and `router.use()` call **before** the `notFoundHandler` line:

```typescript
import [entityName]Routes from './[entity].routes';
// ...
router.use('/[entities]', [entityName]Routes);
```

---

## Step 7 — Integration Test

**File:** `src/routes/[entity].routes.test.ts`

Use the **native Node.js test runner** (`node:test` + `node:assert`). Mirror the style of `password.service.test.ts`. Run tests with `npm test`.

```typescript
import assert from 'node:assert';
import { describe, test } from 'node:test';

// Lightweight integration smoke tests.
// For full HTTP tests, use a shared test server helper if one exists.

describe('[entity].routes', () => {
  test('should export router module without errors', async () => {
    // Dynamically import to catch any bootstrap errors
    const mod = await import('./[entity].routes.ts');
    assert.ok(mod.default, 'Router should be the default export');
  });

  // Add more targeted tests per route as business logic is implemented:
  // test('POST /[entities] returns 201 with valid body', ...)
  // test('GET /[entities]/:id returns 404 for unknown id', ...)
});
```

> Run the full test suite with:
> ```bash
> npm test
> ```

---

## Checklist Summary

| # | File | Status |
|---|------|--------|
| 1 | `prisma/schema.prisma` — new model added | ☐ |
| 2 | `src/dto/[entity].dto.ts` — Zod Create + Update schemas | ☐ |
| 3 | `src/repositories/[entity].repository.ts` — Prisma CRUD ops | ☐ |
| 4 | `src/services/[entity].service.ts` — business logic + error throwing | ☐ |
| 5 | `src/controllers/[entity].controller.ts` — Express 5 async handlers | ☐ |
| 6a | `src/routes/[entity].routes.ts` — router with validation | ☐ |
| 6b | `src/routes/index.ts` — mount new router | ☐ |
| 7 | `src/routes/[entity].routes.test.ts` — smoke tests | ☐ |
