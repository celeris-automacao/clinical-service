/**
 * check-reset-tokens.ts
 *
 * Inspects the `password_reset_tokens` table and verifies that stale tokens
 * (expired or already used) are correctly identified. Optionally purges them.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run check-reset-tokens          # dry-run inspection
 *   pnpm --filter @workspace/scripts run check-reset-tokens -- --purge  # actually delete stale tokens
 *
 * Exit codes:
 *   0 — success
 *   1 — unexpected error
 */

import { db, passwordResetTokensTable } from "@workspace/db";
import { or, lt, isNotNull, isNull, gte, and } from "drizzle-orm";

const PURGE = process.argv.includes("--purge");
const now = new Date();

function fmt(d: Date): string {
  return d.toISOString().replace("T", " ").substring(0, 19) + " UTC";
}

async function main() {
  console.log(`\n=== Reset Token Inspector ===`);
  console.log(`Run time : ${fmt(now)}`);
  console.log(`Mode     : ${PURGE ? "PURGE (will delete stale tokens)" : "DRY-RUN (read-only)"}\n`);

  // ── Fetch all tokens ──────────────────────────────────────────────────────
  const all = await db.select().from(passwordResetTokensTable);

  const expired = all.filter((t) => t.expiresAt < now && t.usedAt === null);
  const used    = all.filter((t) => t.usedAt !== null);
  const valid   = all.filter((t) => t.expiresAt >= now && t.usedAt === null);

  console.log(`Total tokens : ${all.length}`);
  console.log(`  Expired    : ${expired.length}  (expiresAt < now, not yet used)`);
  console.log(`  Used       : ${used.length}  (usedAt IS NOT NULL)`);
  console.log(`  Valid      : ${valid.length}  (unexpired and unused)\n`);

  // ── Detail tables ─────────────────────────────────────────────────────────
  if (expired.length > 0) {
    console.log("── EXPIRED tokens (would be deleted) ──");
    for (const t of expired) {
      const minsAgo = Math.round((now.getTime() - t.expiresAt.getTime()) / 60_000);
      console.log(
        `  id=${t.id}  userId=${t.userId}  expired=${fmt(t.expiresAt)}  (${minsAgo} min ago)`
      );
    }
    console.log();
  }

  if (used.length > 0) {
    console.log("── USED tokens (would be deleted) ──");
    for (const t of used) {
      console.log(
        `  id=${t.id}  userId=${t.userId}  usedAt=${fmt(t.usedAt!)}  expiresAt=${fmt(t.expiresAt)}`
      );
    }
    console.log();
  }

  if (valid.length > 0) {
    console.log("── VALID tokens (would be kept) ──");
    for (const t of valid) {
      const minsLeft = Math.round((t.expiresAt.getTime() - now.getTime()) / 60_000);
      console.log(
        `  id=${t.id}  userId=${t.userId}  expiresAt=${fmt(t.expiresAt)}  (${minsLeft} min left)`
      );
    }
    console.log();
  }

  // ── Verify the SQL predicate matches what we counted ─────────────────────
  //
  // deleteStaleResetTokens uses: expiresAt < now  OR  usedAt IS NOT NULL
  // We verify it here by running the same WHERE clause as a SELECT first.
  const staleViaQuery = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      or(
        lt(passwordResetTokensTable.expiresAt, now),
        isNotNull(passwordResetTokensTable.usedAt)
      )
    );

  const validViaQuery = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        gte(passwordResetTokensTable.expiresAt, now),
        isNull(passwordResetTokensTable.usedAt)
      )
    );

  const expectedStaleCount = expired.length + used.length;
  const staleMatch  = staleViaQuery.length === expectedStaleCount;
  const validMatch  = validViaQuery.length === valid.length;

  console.log("── Predicate verification ──");
  console.log(
    `  Stale (expired OR used) via SQL : ${staleViaQuery.length}  ` +
    `(expected ${expectedStaleCount}) → ${staleMatch ? "✓ MATCH" : "✗ MISMATCH"}`
  );
  console.log(
    `  Valid (unexpired AND unused) via SQL : ${validViaQuery.length}  ` +
    `(expected ${valid.length}) → ${validMatch ? "✓ MATCH" : "✗ MISMATCH"}`
  );
  console.log();

  if (!staleMatch || !validMatch) {
    console.error("ERROR: Predicate verification failed — counts do not match.\n");
    process.exit(1);
  }

  // ── Optional purge ────────────────────────────────────────────────────────
  if (PURGE) {
    if (expectedStaleCount === 0) {
      console.log("Nothing to purge — no stale tokens found.");
    } else {
      const deleted = await db
        .delete(passwordResetTokensTable)
        .where(
          or(
            lt(passwordResetTokensTable.expiresAt, now),
            isNotNull(passwordResetTokensTable.usedAt)
          )
        )
        .returning({ id: passwordResetTokensTable.id });

      console.log(`Purged ${deleted.length} stale token(s): ids=[${deleted.map((r) => r.id).join(", ")}]`);

      // Verify valid tokens survived
      const remaining = await db.select().from(passwordResetTokensTable);
      const allRemainingValid = remaining.every((t) => t.expiresAt >= now && t.usedAt === null);

      console.log(`\nPost-purge check: ${remaining.length} token(s) remain.`);
      if (remaining.length !== valid.length) {
        console.error(
          `ERROR: Expected ${valid.length} remaining token(s) but found ${remaining.length}.`
        );
        process.exit(1);
      }
      if (!allRemainingValid) {
        console.error("ERROR: Some remaining tokens are stale — purge was incomplete.");
        process.exit(1);
      }
      console.log("All remaining tokens are valid. ✓");
    }
  } else {
    if (expectedStaleCount > 0) {
      console.log(`Re-run with --purge to delete the ${expectedStaleCount} stale token(s).`);
    } else {
      console.log("No stale tokens found. Table is clean.");
    }
  }

  console.log("\nDone.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
