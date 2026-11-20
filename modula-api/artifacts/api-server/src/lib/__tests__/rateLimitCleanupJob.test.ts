import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock heavy dependencies before any local imports ─────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    delete: vi.fn(),
  },
  requestAccessAttemptsTable: {},
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { logger } from "../logger";
import { runRateLimitCleanup } from "../rateLimitCleanupJob";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recursively walk any value to collect all Date instances found within it.
 * Used to extract the cutoff Date from a drizzle `lt()` expression without
 * depending on drizzle's internal object structure.
 */
function findDatesInObject(obj: unknown, visited = new Set<object>()): Date[] {
  if (obj instanceof Date) return [obj];
  if (!obj || typeof obj !== "object") return [];
  if (visited.has(obj as object)) return [];
  visited.add(obj as object);
  const results: Date[] = [];
  for (const val of Object.values(obj as Record<string, unknown>)) {
    results.push(...findDatesInObject(val, visited));
  }
  return results;
}

/**
 * Build a delete chain that captures the argument passed to `.where()` so
 * tests can inspect the drizzle expression without depending on drizzle internals.
 */
function makeDeleteChainWithSpy(
  rowCount: number,
  whereSpy: (expr: unknown) => void
): any {
  const chain: any = {};
  chain.where = vi.fn((expr: unknown) => {
    whereSpy(expr);
    return Promise.resolve({ rowCount });
  });
  return chain;
}

function makeDeleteChain(rowCount = 0): any {
  const chain: any = {};
  chain.where = vi.fn().mockResolvedValue({ rowCount });
  return chain;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runRateLimitCleanup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls db.delete and passes a cutoff exactly 1 hour before now", async () => {
    const FIXED_NOW = 1_750_000_000_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);

    const whereSpy = vi.fn();
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDeleteChainWithSpy(0, whereSpy)
    );

    await runRateLimitCleanup();

    expect(db.delete).toHaveBeenCalledOnce();
    expect(whereSpy).toHaveBeenCalledOnce();

    const expr = whereSpy.mock.calls[0][0];
    const dates = findDatesInObject(expr);
    expect(dates).toHaveLength(1);
    // The cutoff must be exactly Date.now() - 1 hour (3 600 000 ms)
    expect(dates[0].getTime()).toBe(FIXED_NOW - 3_600_000);
  });

  it("rows timestamped BEFORE the cutoff are targeted for deletion (cutoff is in the past)", async () => {
    const FIXED_NOW = 1_750_000_000_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);

    const whereSpy = vi.fn();
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDeleteChainWithSpy(3, whereSpy)
    );

    await runRateLimitCleanup();

    const expr = whereSpy.mock.calls[0][0];
    const dates = findDatesInObject(expr);
    const cutoff = dates[0].getTime();

    // A row from 2 hours ago is OLDER than the cutoff — it should be deleted.
    const twoHoursAgo = FIXED_NOW - 2 * 3_600_000;
    expect(twoHoursAgo).toBeLessThan(cutoff);

    // A row from 30 minutes ago is WITHIN the window — it should NOT be deleted.
    const thirtyMinutesAgo = FIXED_NOW - 30 * 60 * 1000;
    expect(thirtyMinutesAgo).toBeGreaterThan(cutoff);
  });

  it("does not delete rows that are within the 1-hour window (boundary: exactly 1 hour old is excluded)", async () => {
    const FIXED_NOW = 1_750_000_000_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);

    const whereSpy = vi.fn();
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDeleteChainWithSpy(0, whereSpy)
    );

    await runRateLimitCleanup();

    const expr = whereSpy.mock.calls[0][0];
    const dates = findDatesInObject(expr);
    const cutoff = dates[0].getTime();

    // A row timestamped AT the cutoff is not strictly less-than, so lt() won't
    // match it — it stays in the table.
    expect(cutoff).toBe(FIXED_NOW - 3_600_000);

    // A row from 59 minutes ago is inside the window — newer than the cutoff.
    const fiftyNineMinutesAgo = FIXED_NOW - 59 * 60 * 1000;
    expect(fiftyNineMinutesAgo).toBeGreaterThan(cutoff);
  });

  it("logs the number of deleted rows when rows were removed", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDeleteChain(5)
    );

    await runRateLimitCleanup();

    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const cleanupLog = infoCalls.find(
      (args) =>
        typeof args[1] === "string" &&
        args[1].includes("Rate-limit cleanup")
    );
    expect(cleanupLog).toBeDefined();
    expect(cleanupLog![0]).toMatchObject({ deleted: 5 });
  });

  it("does not log when no rows were deleted", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDeleteChain(0)
    );

    await runRateLimitCleanup();

    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const cleanupLog = infoCalls.find(
      (args) =>
        typeof args[1] === "string" &&
        args[1].includes("Rate-limit cleanup: removed")
    );
    expect(cleanupLog).toBeUndefined();
  });

  it("does not throw when the delete query rejects", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error("DB connection lost")),
    });

    await expect(runRateLimitCleanup()).resolves.toBeUndefined();

    const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls;
    expect(errorCalls.length).toBeGreaterThan(0);
    const errLog = errorCalls[0];
    expect(errLog[0]).toMatchObject({ err: expect.any(Error) });
  });

  it("handles null rowCount gracefully (treats it as 0 deleted)", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: null }),
    });

    await expect(runRateLimitCleanup()).resolves.toBeUndefined();

    // rowCount ?? 0 → 0, so no info log for "removed stale rows"
    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const cleanupLog = infoCalls.find(
      (args) =>
        typeof args[1] === "string" &&
        args[1].includes("Rate-limit cleanup: removed")
    );
    expect(cleanupLog).toBeUndefined();
  });
});
