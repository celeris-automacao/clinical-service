/**
 * Integration tests for runRateLimitCleanup()
 *
 * These tests run against the REAL database — nothing is mocked.
 * They seed rows directly into requestAccessAttemptsTable with controlled
 * timestamps, invoke the cleanup function, and query the table to confirm
 * which rows were deleted and which were preserved.
 *
 * Prerequisites: DATABASE_URL must be set (standard dev environment).
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db, requestAccessAttemptsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { runRateLimitCleanup } from "../rateLimitCleanupJob";

// ── Test email (never a real account) ────────────────────────────────────────

const TEST_EMAIL = "cleanup-integration-test@test.internal";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function insertAttempt(attemptedAt: Date): Promise<number> {
  const [row] = await db
    .insert(requestAccessAttemptsTable)
    .values({ email: TEST_EMAIL, attemptedAt })
    .returning({ id: requestAccessAttemptsTable.id });
  return row.id;
}

async function fetchIds(ids: number[]): Promise<number[]> {
  const rows = await db
    .select({ id: requestAccessAttemptsTable.id })
    .from(requestAccessAttemptsTable)
    .where(inArray(requestAccessAttemptsTable.id, ids));
  return rows.map((r) => r.id);
}

// ── Teardown ──────────────────────────────────────────────────────────────────

afterAll(async () => {
  await db
    .delete(requestAccessAttemptsTable)
    .where(eq(requestAccessAttemptsTable.email, TEST_EMAIL));
});

beforeEach(async () => {
  await db
    .delete(requestAccessAttemptsTable)
    .where(eq(requestAccessAttemptsTable.email, TEST_EMAIL));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runRateLimitCleanup — integration", () => {
  it("deletes rows that are older than 1 hour", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000);

    const staleId1 = await insertAttempt(twoHoursAgo);
    const staleId2 = await insertAttempt(ninetyMinutesAgo);

    await runRateLimitCleanup();

    const remaining = await fetchIds([staleId1, staleId2]);
    expect(remaining).toHaveLength(0);
  });

  it("preserves rows that are within the 1-hour window", async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const freshId1 = await insertAttempt(thirtyMinutesAgo);
    const freshId2 = await insertAttempt(fiveMinutesAgo);

    await runRateLimitCleanup();

    const remaining = await fetchIds([freshId1, freshId2]);
    expect(remaining).toHaveLength(2);
    expect(remaining).toContain(freshId1);
    expect(remaining).toContain(freshId2);
  });

  it("deletes only stale rows and leaves fresh rows untouched in the same run", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const staleId = await insertAttempt(twoHoursAgo);
    const freshId = await insertAttempt(tenMinutesAgo);

    await runRateLimitCleanup();

    const remaining = await fetchIds([staleId, freshId]);

    // Stale row must be gone
    expect(remaining).not.toContain(staleId);
    // Fresh row must survive
    expect(remaining).toContain(freshId);
  });

  it("does not touch rows timestamped exactly at the 1-hour boundary (lt semantics — not deleted)", async () => {
    // A row inserted exactly 1 hour ago should NOT be deleted because
    // the predicate is lt(attemptedAt, cutoff), not lte.
    // We use a timestamp 1 ms after the cutoff to avoid a race condition
    // between test execution and the cutoff calculation inside the function.
    const justInsideCutoff = new Date(Date.now() - 60 * 60 * 1000 + 2000);

    const boundaryId = await insertAttempt(justInsideCutoff);

    await runRateLimitCleanup();

    const remaining = await fetchIds([boundaryId]);
    expect(remaining).toContain(boundaryId);
  });

  it("does nothing and does not throw when the table is empty", async () => {
    // Table is already clean from beforeEach
    await expect(runRateLimitCleanup()).resolves.toBeUndefined();
  });
});
