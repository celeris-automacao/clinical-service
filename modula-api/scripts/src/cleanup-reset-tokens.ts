/**
 * cleanup-reset-tokens.ts
 *
 * Nightly safety-net that deletes stale password-reset tokens:
 *   - Expired tokens  (expires_at < now())
 *   - Already-used tokens  (used_at IS NOT NULL)
 *
 * The API server already does an opportunistic cleanup on every reset request,
 * but this script guarantees a sweep even when resets are infrequent.
 *
 * Usage (direct):
 *   pnpm --filter @workspace/scripts run cleanup:reset-tokens
 *
 * Schedule (Replit workflow):
 *   Command : pnpm --filter @workspace/scripts run cleanup:reset-tokens
 *   Schedule: nightly (e.g. 03:00 UTC)
 *
 * Exit codes:
 *   0 — completed successfully (0 or more rows deleted)
 *   1 — unexpected error
 */

import { db, passwordResetTokensTable } from "@workspace/db";
import { or, lt, isNotNull } from "drizzle-orm";

function fmt(d: Date): string {
  return d.toISOString().replace("T", " ").substring(0, 19) + " UTC";
}

async function main(): Promise<void> {
  const now = new Date();
  console.log(`[cleanup-reset-tokens] Starting at ${fmt(now)}`);

  const deleted = await db
    .delete(passwordResetTokensTable)
    .where(
      or(
        lt(passwordResetTokensTable.expiresAt, now),
        isNotNull(passwordResetTokensTable.usedAt)
      )
    )
    .returning({ id: passwordResetTokensTable.id });

  if (deleted.length === 0) {
    console.log("[cleanup-reset-tokens] No stale tokens found. Table is clean.");
  } else {
    console.log(
      `[cleanup-reset-tokens] Deleted ${deleted.length} stale token(s): ids=[${deleted.map((r) => r.id).join(", ")}]`
    );
  }

  console.log(`[cleanup-reset-tokens] Done at ${fmt(new Date())}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[cleanup-reset-tokens] Unexpected error:", err);
  process.exit(1);
});
