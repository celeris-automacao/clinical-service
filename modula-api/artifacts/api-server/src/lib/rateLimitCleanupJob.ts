import { lt } from "drizzle-orm";
import { db, requestAccessAttemptsTable } from "@workspace/db";
import { logger } from "./logger";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_ACCESS_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function runRateLimitCleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - REQUEST_ACCESS_WINDOW_MS);
  try {
    const result = await db
      .delete(requestAccessAttemptsTable)
      .where(lt(requestAccessAttemptsTable.attemptedAt, cutoff));
    const deleted = result.rowCount ?? 0;
    if (deleted > 0) {
      logger.info({ deleted }, "Rate-limit cleanup: removed stale request-access rows");
    }
  } catch (err) {
    logger.error({ err }, "Rate-limit cleanup: failed to purge stale rows");
  }
}

export function startRateLimitCleanupJob(): void {
  void runRateLimitCleanup();
  setInterval(() => {
    void runRateLimitCleanup();
  }, CLEANUP_INTERVAL_MS);
  logger.info({ intervalHours: 1 }, "Rate-limit cleanup job: scheduled every hour");
}
