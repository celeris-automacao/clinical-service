import { and, isNull, lt, sql } from "drizzle-orm";
import { db, auditFailuresTable } from "@workspace/db";
import { logger } from "./logger";

const SWEEP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Scans `audit_failures` for rows that are:
 *   - older than 2 hours (failedAt < now - 2h)
 *   - still unresolved  (resolvedAt IS NULL)
 *   - owner never notified (ownerNotifiedAt IS NULL)
 *
 * These rows indicate that the normal write-path email dispatch either never
 * ran or failed silently (e.g. the ownerNotifiedAt UPDATE itself threw).
 * Rather than re-entering the complex email-dispatch logic here, we emit a
 * structured WARNING so an ops alert or log query can catch the pile-up and
 * a human can investigate.
 *
 * Grouped output: one log line per clinicId so the count is actionable.
 */
export async function runAuditFailureSweep(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  let rows: { clinicId: number | null; count: number }[];
  try {
    rows = await db
      .select({
        clinicId: auditFailuresTable.clinicId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(auditFailuresTable)
      .where(
        and(
          lt(auditFailuresTable.failedAt, cutoff),
          isNull(auditFailuresTable.resolvedAt),
          isNull(auditFailuresTable.ownerNotifiedAt)
        )
      )
      .groupBy(auditFailuresTable.clinicId);
  } catch (err) {
    logger.error({ err }, "audit-failure-sweep: DB query failed — cannot determine stale unnotified rows");
    return;
  }

  if (rows.length === 0) {
    logger.debug("audit-failure-sweep: no stale unnotified audit failures found");
    return;
  }

  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);
  logger.warn(
    {
      audit_failure_sweep: true,
      staleThresholdHours: STALE_THRESHOLD_MS / (60 * 60 * 1000),
      totalCount,
      byClinic: rows.map((r) => ({ clinicId: r.clinicId, count: r.count })),
    },
    `audit-failure-sweep: ${totalCount} unresolved audit failure(s) with ownerNotifiedAt IS NULL older than 2 hours — owner notification may have been missed`
  );
}

export function startAuditFailureSweepJob(): void {
  void runAuditFailureSweep();
  setInterval(() => {
    void runAuditFailureSweep();
  }, SWEEP_INTERVAL_MS);
  logger.info(
    { intervalMinutes: SWEEP_INTERVAL_MS / 60000, thresholdHours: STALE_THRESHOLD_MS / (60 * 60 * 1000) },
    "audit-failure-sweep job: scheduled"
  );
}
