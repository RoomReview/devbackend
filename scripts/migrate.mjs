#!/usr/bin/env node
/**
 * migrate.mjs — Prisma migration runner
 *
 * Commands:
 *   generate              → prisma generate (regenerates Prisma Client from schema)
 *   init [name]          → prisma migrate dev --name <name> (creates + applies a new migration in dev)
 *   rollforward          → prisma migrate deploy (applies all pending migrations — production safe)
 *   rollback             → Reverts the last applied migration using its down.sql
 *   rollback --to <name> → Reverts every migration applied AFTER <name>, in reverse order
 *   rollback --list      → Lists all applied migrations (newest first)
 *
 * Usage (via npm scripts):
 *   npm run orm:generate
 *   npm run orm:init -- add_sessions_table
 *   npm run orm:rollforward
 *   npm run orm:rollback
 *   npm run orm:rollback -- --to 20260101000000_add_users_table
 *   npm run orm:rollback -- --list
 *
 * Rollback convention:
 *   For every migration Prisma generates at prisma/migrations/<ts>_<name>/migration.sql,
 *   you must manually author a companion prisma/migrations/<ts>_<name>/down.sql
 *   containing the inverse SQL (DROP TABLE, DROP COLUMN, etc.).
 *   The script will refuse to rollback if no down.sql is found — this is intentional.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'prisma', 'migrations');

// Load .env so DATABASE_URL is available when running rollback
const dotenvPath = join(ROOT, '.env');
if (existsSync(dotenvPath)) {
  const { config } = await import('dotenv');
  config({ path: dotenvPath });
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

const [, , command, ...args] = process.argv;

if (!command) {
  printHelp();
  process.exit(1);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

switch (command) {
  case 'generate':
    await runGenerate();
    break;

  case 'init':
    await runInit(args[0]);
    break;

  case 'rollforward':
    await runRollforward();
    break;

  case 'rollback': {
    // Parse flags from remaining args
    const toIdx = args.indexOf('--to');
    const listFlag = args.includes('--list');
    const targetMigration = toIdx !== -1 ? args[toIdx + 1] : null;
    await runRollback({ targetMigration, listFlag });
    break;
  }

  default:
    console.error(`\n❌  Unknown command: "${command}"\n`);
    printHelp();
    process.exit(1);
}

// ─── Command implementations ──────────────────────────────────────────────────

/**
 * Regenerate the Prisma Client from schema.prisma.
 * Run this after any schema change before using the client in app code.
 */
async function runGenerate() {
  console.log('⚙️  Generating Prisma Client from schema...');
  shell('npx prisma generate');
  console.log('✅  Prisma Client generated.');
}

/**
 * Create a new migration file and apply it to the local dev database.
 * Wraps `prisma migrate dev` which:
 *   1. Diffs the schema against the current DB state
 *   2. Writes the SQL to prisma/migrations/<timestamp>_<name>/migration.sql
 *   3. Applies it immediately
 *
 * After this runs, author a down.sql in the same folder to enable rollback.
 *
 * @param {string|undefined} name  Migration label, e.g. "add_sessions_table"
 */
async function runInit(name) {
  const migrationName = name || 'init';
  console.log(`📦  Creating migration: "${migrationName}"...`);
  shell(`npx prisma migrate dev --name ${migrationName}`);
  console.log(`✅  Migration "${migrationName}" created and applied.`);
  console.log(
    `\n📝  Tip: author a down.sql in the new migration folder to enable rollback.\n`,
  );
}

/**
 * Apply all pending migrations in order.
 * Uses `prisma migrate deploy` — this is the production-safe command.
 * It never prompts, never generates new migrations, never resets the DB.
 */
async function runRollforward() {
  console.log('🚀  Deploying pending migrations...');
  shell('npx prisma migrate deploy');
  console.log('✅  All pending migrations applied.');
}

/**
 * Roll back migrations.
 *
 * Modes:
 *   --list            Print all applied migrations (newest first) and exit.
 *   --to <name>       Roll back every migration applied AFTER <name>, in reverse order.
 *                     <name> is the exact migration_name from _prisma_migrations
 *                     (e.g. "20260308120000_add_sessions_table").
 *                     The target migration itself is NOT rolled back.
 *   (no flags)        Roll back only the single most-recently applied migration.
 *
 * Each rolled-back migration must have a companion down.sql next to migration.sql.
 *
 * @param {{ targetMigration: string|null, listFlag: boolean }} opts
 */
async function runRollback({ targetMigration, listFlag }) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌  DATABASE_URL is not set. Cannot connect to the database.');
    process.exit(1);
  }

  let pg;
  try {
    pg = (await import('pg')).default;
  } catch {
    console.error('❌  The "pg" package is not available. Run: npm install pg');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    // ── Fetch all applied migrations, newest first ──────────────────────────
    const { rows: applied } = await client.query(
      `SELECT migration_name, finished_at
       FROM _prisma_migrations
       WHERE finished_at IS NOT NULL
         AND rolled_back_at IS NULL
         AND applied_steps_count > 0
       ORDER BY finished_at DESC`,
    );

    if (applied.length === 0) {
      console.log('ℹ️   No applied migrations found — nothing to roll back.');
      return;
    }

    // ── --list mode ─────────────────────────────────────────────────────────
    if (listFlag) {
      console.log('\n📋  Applied migrations (newest → oldest):\n');
      applied.forEach(({ migration_name, finished_at }, i) => {
        const marker = i === 0 ? ' ← latest' : '';
        console.log(`  ${String(i + 1).padStart(2, '0')}  ${migration_name}  (${finished_at.toISOString()})${marker}`);
      });
      console.log('');
      return;
    }

    // ── Determine which migrations to roll back ──────────────────────────────
    let toRollback;

    if (targetMigration) {
      // Validate the target exists in history
      const targetIdx = applied.findIndex((r) => r.migration_name === targetMigration);
      if (targetIdx === -1) {
        console.error(`\n❌  Migration not found in applied history: "${targetMigration}"`);
        console.error('    Run with --list to see available migration names.\n');
        process.exit(1);
      }
      // Roll back everything NEWER than the target (target itself is kept)
      // applied is newest-first, so slice up to (but not including) targetIdx
      toRollback = applied.slice(0, targetIdx);
      if (toRollback.length === 0) {
        console.log(`ℹ️   "${targetMigration}" is already the latest migration — nothing to roll back.`);
        return;
      }
      console.log(`\n🎯  Rolling back to: ${targetMigration}`);
      console.log(`    Migrations to revert (${toRollback.length}): ${toRollback.map((r) => r.migration_name).join(', ')}\n`);
    } else {
      // Default: only the last one
      toRollback = [applied[0]];
      console.log(`\n🔍  Rolling back last migration: ${applied[0].migration_name}\n`);
    }

    // ── Verify all required down.sql files exist before touching the DB ─────
    for (const { migration_name } of toRollback) {
      const downSqlPath = join(MIGRATIONS_DIR, migration_name, 'down.sql');
      if (!existsSync(downSqlPath)) {
        console.error(`❌  Missing down.sql for: ${migration_name}`);
        console.error(`    Expected at: ${downSqlPath}`);
        console.error('    No changes were made. Author the missing file(s) and retry.\n');
        process.exit(1);
      }
      const content = readFileSync(downSqlPath, 'utf-8').trim();
      if (!content) {
        console.error(`❌  down.sql is empty for: ${migration_name} — ${downSqlPath}\n`);
        process.exit(1);
      }
    }

    // ── Execute rollbacks in order (newest → oldest), all in one transaction ─
    await client.query('BEGIN');

    for (const { migration_name } of toRollback) {
      const downSql = readFileSync(
        join(MIGRATIONS_DIR, migration_name, 'down.sql'),
        'utf-8',
      ).trim();

      console.log(`⏪  Reverting: ${migration_name}`);
      await client.query(downSql);
      await client.query(
        `DELETE FROM _prisma_migrations WHERE migration_name = $1`,
        [migration_name],
      );
      console.log(`    ✓ done`);
    }

    await client.query('COMMIT');

    console.log(`\n✅  Rolled back ${toRollback.length} migration(s).\n`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n❌  Rollback failed (all changes reverted):\n    ${err.message}\n`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shell(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

function printHelp() {
  console.log(`
Usage: node scripts/migrate.mjs <command> [options]

Commands:
  generate                        Regenerate Prisma Client from schema.prisma
  init [migration-name]           Create a new migration and apply it (dev only)
  rollforward                     Apply all pending migrations (production safe)
  rollback                        Revert only the last applied migration
  rollback --to <migration-name>  Revert all migrations applied after <migration-name>
  rollback --list                 List all applied migrations (newest first)

Examples:
  node scripts/migrate.mjs generate
  node scripts/migrate.mjs init add_sessions_table
  node scripts/migrate.mjs rollforward
  node scripts/migrate.mjs rollback
  node scripts/migrate.mjs rollback --list
  node scripts/migrate.mjs rollback --to 20260101000000_add_users_table
`);
}
