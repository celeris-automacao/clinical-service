import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { createHash } from "crypto";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

/**
 * Run all pending Drizzle migrations against the database.
 *
 * Handles the "push-first" case: if the DB already has tables but no
 * drizzle migration history, it stamps the idx=0 baseline migration so
 * migrate() applies only the subsequent migrations (0001+).
 *
 * Root cause of the previous silent-skip bug: drizzle's migrator compares
 * each entry's `when` timestamp (folderMillis) against the `created_at` of
 * the last tracked migration. Entries whose `when` is <= the last
 * `created_at` are silently skipped even if they were never executed.
 * All journal `when` values must be strictly monotonically increasing.
 *
 * @param migrationsFolder - Absolute path to the migrations directory.
 *   Defaults to the `migrations/` folder adjacent to this package's source.
 *   Pass an explicit path when calling from a bundled artifact where
 *   import.meta.url would resolve to the bundle output directory.
 */
export async function migrateDb(migrationsFolder?: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const folder =
    migrationsFolder ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    await stampBaselineIfNeeded(pool, folder);
    await logPendingMigrations(pool, folder);
    await migrate(db, { migrationsFolder: folder });
    await verifyMigrationCount(pool, folder);
    await verifySchemaTablesExist(pool);
    console.log("Migrations applied successfully");
  } finally {
    await pool.end();
  }
}

/**
 * When the DB already has a public schema (managed via drizzle-kit push)
 * but no migration history, stamp ONLY the idx=0 baseline migration.
 *
 * All subsequent migrations (0001+) are left un-stamped so migrate()
 * executes them. Those migrations use IF NOT EXISTS / IF EXISTS guards
 * and are safe to re-run on a push-managed DB.
 *
 * IMPORTANT: drizzle's migrator skips any entry whose `when` timestamp is
 * <= the `created_at` of the last tracked row (ORDER BY created_at DESC
 * LIMIT 1). This is why all journal entries MUST have strictly increasing
 * `when` values — entries with out-of-order timestamps are silently skipped.
 */
async function stampBaselineIfNeeded(
  pool: Pool,
  migrationsFolder: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const { rows: existing } = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM drizzle.__drizzle_migrations`,
    );
    const alreadyTracked = Number(existing[0]?.count ?? 0) > 0;
    if (alreadyTracked) {
      return;
    }

    const { rows: tableRows } = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists
    `);
    const tablesExist = tableRows[0]?.exists ?? false;

    if (!tablesExist) {
      return;
    }

    console.log(
      "Detected existing schema managed via drizzle-kit push. " +
        "Stamping baseline migration (idx=0) as applied...",
    );

    const journalPath = path.join(migrationsFolder, "meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
    };

    for (const entry of journal.entries) {
      if (entry.idx !== 0) {
        continue;
      }
      const sqlContent = readFileSync(
        path.join(migrationsFolder, `${entry.tag}.sql`),
        "utf8",
      );
      const hash = createHash("sha256").update(sqlContent).digest("hex");
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [hash, entry.when],
      );
      console.log(`  Stamped: ${entry.tag}`);
    }
  } finally {
    client.release();
  }
}

/**
 * Determine and log which migrations drizzle will apply on this run.
 *
 * Mirrors drizzle's own logic: fetch the last tracked migration by
 * created_at, then flag any journal entry whose `when` timestamp is
 * strictly greater than that value. This gives an accurate pre-flight
 * view of exactly what SQL is about to be executed.
 */
async function logPendingMigrations(
  pool: Pool,
  migrationsFolder: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    const journalPath = path.join(migrationsFolder, "meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
    };

    const { rows } = await client.query<{ created_at: string }>(
      `SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
    );
    const lastAppliedAt = rows[0] ? Number(rows[0].created_at) : null;

    const pending = journal.entries.filter(
      (e) => lastAppliedAt === null || e.when > lastAppliedAt,
    );

    if (pending.length === 0) {
      console.log("No pending migrations — database is up to date");
    } else {
      console.log(`Applying ${pending.length} pending migration(s):`);
      for (const entry of pending) {
        console.log(`  → ${entry.tag}`);
      }
    }
  } finally {
    client.release();
  }
}

/**
 * After migrate() completes, verify that the number of rows in
 * __drizzle_migrations equals the number of .sql files in the migrations
 * folder. A mismatch means some migrations were silently skipped.
 */
async function verifyMigrationCount(
  pool: Pool,
  migrationsFolder: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    const sqlFiles = readdirSync(migrationsFolder).filter((f) =>
      f.endsWith(".sql"),
    );
    const sqlCount = sqlFiles.length;

    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM drizzle.__drizzle_migrations`,
    );
    const trackedCount = Number(rows[0]?.count ?? 0);

    if (trackedCount !== sqlCount) {
      console.warn(
        `[migrate] WARNING: __drizzle_migrations has ${trackedCount} entries ` +
          `but ${sqlCount} SQL files exist in ${migrationsFolder}. ` +
          `Some migrations may not have been applied. ` +
          `Run 'pnpm --filter @workspace/db run migrate' to inspect.`,
      );
    } else {
      console.log(
        `[migrate] Verified: ${trackedCount}/${sqlCount} migrations tracked`,
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Diff every `pgTable(...)` exported from `lib/db/src/schema/index.ts`
 * against the tables that actually exist in the connected database.
 *
 * Guards against schema drift where a table is added to a schema file
 * (and used by application code) but `drizzle-kit generate` was never run,
 * so no migration/snapshot exists for it. That drift is invisible to
 * TypeScript and to `verifyMigrationCount` (which only counts tracked
 * migrations, not actual tables), and previously surfaced as a 500 in
 * production the first time a route queried the missing table.
 *
 * Throws (rather than warns) so a missing table fails startup/CI loudly
 * instead of shipping.
 */
async function verifySchemaTablesExist(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const expectedTables = new Map<string, string>();
    for (const [exportName, value] of Object.entries(schema)) {
      if (is(value, PgTable)) {
        const config = getTableConfig(value);
        expectedTables.set(config.name, exportName);
      }
    }

    if (expectedTables.size === 0) {
      return;
    }

    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const actualTables = new Set(rows.map((r) => r.table_name));

    const missing = [...expectedTables.entries()].filter(
      ([tableName]) => !actualTables.has(tableName),
    );

    if (missing.length > 0) {
      const details = missing
        .map(([tableName, exportName]) => `  - ${tableName} (exported as ${exportName})`)
        .join("\n");
      throw new Error(
        `[migrate] Schema drift detected: ${missing.length} table(s) defined in ` +
          `lib/db/src/schema/ have no corresponding table in the database:\n${details}\n` +
          `This usually means a pgTable was added without running ` +
          `'pnpm --filter @workspace/db run generate' + 'migrate'. ` +
          `Generate and apply the missing migration before continuing.`,
      );
    }

    console.log(
      `[migrate] Verified: all ${expectedTables.size} schema table(s) exist in the database`,
    );
  } finally {
    client.release();
  }
}

// Run standalone when executed directly via tsx/node (not imported as a module).
// We match on the argv path instead of import.meta.url because esbuild bundles
// this module inline — import.meta.url inside the bundle resolves to the
// bundle file, making it indistinguishable from the host entry point.
const invokedFile = process.argv[1] ?? "";
const isMain =
  invokedFile.endsWith("/src/migrate.ts") ||
  invokedFile.endsWith("\\src\\migrate.ts") ||
  invokedFile.endsWith("/migrate.js") ||
  invokedFile.endsWith("\\migrate.js");

if (isMain) {
  migrateDb().catch((err: unknown) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
