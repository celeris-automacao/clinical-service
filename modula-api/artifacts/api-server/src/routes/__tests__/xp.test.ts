import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  xpEntriesTable: { patientId: {}, points: {}, date: {} },
  patientsTable: { userId: {}, id: {} },
  waterEntriesTable: { patientId: {}, date: {} },
  exerciseEntriesTable: { patientId: {}, date: {} },
  calorieEntriesTable: { patientId: {}, date: {} },
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  ensurePatientAccess: vi.fn().mockResolvedValue({ id: 5 }),
  ACCESS_TOKEN_PREFIX: "clinic_pat_",
  hashAccessToken: vi.fn(),
}));

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import xpRouter from "../xp";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(xpRouter);
  return app;
}

/**
 * Build a select chain: db.select().from(table).where(cond) → Promise<rows>
 * The `and`, `gte`, `eq` from drizzle-orm just pass args through; since db is
 * fully mocked, the actual SQL object passed to .where() is ignored.
 */
function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

/**
 * Wire up db.select to return results in order for the 12 sequential calls
 * made by GET /xp.
 *
 * Call order (matching xp.ts Promise.all batches):
 *  1-3:  xpEntries total / weekly / monthly   → [{total: N}]
 *  4-6:  waterEntries/exerciseEntries/calorieEntries for current week  → [{date}]
 *  7-9:  waterEntries/exerciseEntries/calorieEntries for current month → [{date}]
 * 10-12: waterEntries/exerciseEntries/calorieEntries streak window     → [{date}]
 */
function setupSelectQueue(resultSets: unknown[][]) {
  let idx = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const rows = resultSets[idx++] ?? [];
    return makeSelectChain(rows);
  });
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_USER = {
  id: 1,
  role: "clinic_owner" as const,
  email: "owner@clinic.com",
  name: "Owner",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  isTemporaryPassword: false,
  avatarUrl: null,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PATIENT_ID = 5;

// ── GET /xp — streak calculation with known data ──────────────────────────────

/**
 * Reference date: 2026-07-01 (Tuesday).
 *
 * The patient has all three goals completed on 2026-06-30, 2026-06-29, and
 * 2026-06-28, but NOT on 2026-07-01 (today). The streak logic starts counting
 * from yesterday when today is incomplete, so the expected streak is 3.
 */
describe("GET /xp — streak calculation", () => {
  const ANCHOR = "2026-07-01";
  const D1 = "2026-06-30";
  const D2 = "2026-06-29";
  const D3 = "2026-06-28";

  const completeDates = [{ date: D1 }, { date: D2 }, { date: D3 }];

  /**
   * Build the 12-element result queue representing:
   * - 3 complete days (D-1, D-2, D-3), today incomplete
   * - 150 total XP (3 × 50)
   */
  function buildResultQueue() {
    return [
      // 1-3: xpEntries total / weekly / monthly
      [{ total: 150 }],
      [{ total: 150 }],
      [{ total: 150 }],
      // 4-6: water/exercise/calorie for current week
      completeDates,
      completeDates,
      completeDates,
      // 7-9: water/exercise/calorie for current month
      completeDates,
      completeDates,
      completeDates,
      // 10-12: water/exercise/calorie for streak window
      completeDates,
      completeDates,
      completeDates,
    ];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${ANCHOR}T12:00:00.000Z`));

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns streak=3 when 3 consecutive prior days are complete and today is not", async () => {
    setupSelectQueue(buildResultQueue());

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(3);
    expect(res.body.patientId).toBe(PATIENT_ID);
  });

  it("explicit today matching server date returns the same streak as omitting it", async () => {
    setupSelectQueue(buildResultQueue());
    const resWithout = await request(buildApp()).get(
      `/xp?patientId=${PATIENT_ID}`
    );

    setupSelectQueue(buildResultQueue());
    const resWith = await request(buildApp()).get(
      `/xp?patientId=${PATIENT_ID}&today=${ANCHOR}`
    );

    expect(resWithout.status).toBe(200);
    expect(resWith.status).toBe(200);
    expect(resWith.body.currentStreak).toBe(resWithout.body.currentStreak);
    expect(resWith.body.currentStreak).toBe(3);
  });

  it("passing today one day earlier shifts the anchor so the streak counts differently", async () => {
    // Anchor = D1 (2026-06-30). Today (D1) IS complete, D2 and D3 are also
    // complete, so counting starts from today and the streak is still 3.
    // But the today-goals object changes: today (D1) is now flagged as complete.
    const D1Dates = [{ date: D1 }, { date: D2 }, { date: D3 }];

    setupSelectQueue([
      [{ total: 150 }],
      [{ total: 150 }],
      [{ total: 150 }],
      D1Dates,
      D1Dates,
      D1Dates,
      D1Dates,
      D1Dates,
      D1Dates,
      D1Dates,
      D1Dates,
      D1Dates,
    ]);

    const res = await request(buildApp()).get(
      `/xp?patientId=${PATIENT_ID}&today=${D1}`
    );

    expect(res.status).toBe(200);
    // With anchor = D1, today is D1 which is complete, so streak starts from
    // today and counts D1, D2, D3 → streak = 3.
    expect(res.body.currentStreak).toBe(3);
    // Today's goals: D1 is in the date set, so all three should be true.
    expect(res.body.todayGoals.water).toBe(true);
    expect(res.body.todayGoals.exercise).toBe(true);
    expect(res.body.todayGoals.nutrition).toBe(true);
  });

  it("returns streak=0 when no days have all three goals completed", async () => {
    const noData: unknown[] = [];

    setupSelectQueue([
      [{ total: 0 }],
      [{ total: 0 }],
      [{ total: 0 }],
      noData,
      noData,
      noData,
      noData,
      noData,
      noData,
      noData,
      noData,
      noData,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
    expect(res.body.totalXp).toBe(0);
  });

  it("returns streak=0 when days have partial goal completion (missing one goal)", async () => {
    // Water and exercise done every day but no calorie entries — not complete
    const partialDates = [{ date: D1 }, { date: D2 }, { date: D3 }];
    const noCalories: unknown[] = [];

    setupSelectQueue([
      [{ total: 100 }],
      [{ total: 100 }],
      [{ total: 100 }],
      partialDates, // water ✓
      partialDates, // exercise ✓
      noCalories,   // calories ✗ — streak broken
      partialDates,
      partialDates,
      noCalories,
      partialDates,
      partialDates,
      noCalories,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Targeted AND-gate regression: water and exercise are present on D-1,
   * but calorie entry is absent only on D-1. An OR-based implementation would
   * count D-1 and inflate the streak; the correct AND gate must return 0.
   */
  it("returns streak=0 when D-1 has water+exercise but is missing calories", async () => {
    // Today (2026-07-01) is incomplete — counting starts from D-1 (2026-06-30)
    // D-1 has water ✓ and exercise ✓ but no calories ✗ → D-1 is not complete
    // D-2 and D-3 have all three, but the loop breaks before reaching them
    const withCalories = [{ date: D2 }, { date: D3 }]; // D-2, D-3 only; D-1 absent

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly
      [{ total: 0 }],
      [{ total: 0 }],
      [{ total: 0 }],
      // 4-6: water/exercise/calorie for current week
      [{ date: D1 }, { date: D2 }, { date: D3 }], // water: D-1 ✓
      [{ date: D1 }, { date: D2 }, { date: D3 }], // exercise: D-1 ✓
      withCalories,                                // calories: D-1 ✗
      // 7-9: water/exercise/calorie for current month
      [{ date: D1 }, { date: D2 }, { date: D3 }],
      [{ date: D1 }, { date: D2 }, { date: D3 }],
      withCalories,
      // 10-12: water/exercise/calorie for streak window
      [{ date: D1 }, { date: D2 }, { date: D3 }],
      [{ date: D1 }, { date: D2 }, { date: D3 }],
      withCalories,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    // D-1 is incomplete (missing calories) → streak must not count it → 0
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Complementary positive case: all three goals are present on D-1 but D-2
   * is missing, confirming the AND gate allows a streak of 1 when only D-1 is
   * fully complete.
   */
  it("returns streak=1 when all three goals are present on D-1 only and D-2 is absent", async () => {
    // Today (2026-07-01) is incomplete — counting starts from D-1 (2026-06-30)
    // D-1 has water ✓, exercise ✓, calories ✓ → complete
    // D-2 (2026-06-29) is absent from all sets → streak breaks → total = 1
    const d1Only = [{ date: D1 }];

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly
      [{ total: 50 }],
      [{ total: 50 }],
      [{ total: 50 }],
      // 4-6: water/exercise/calorie for current week
      d1Only,
      d1Only,
      d1Only,
      // 7-9: water/exercise/calorie for current month
      d1Only,
      d1Only,
      d1Only,
      // 10-12: water/exercise/calorie for streak window
      d1Only,
      d1Only,
      d1Only,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    // D-1 is complete, D-2 is missing → streak = 1
    expect(res.body.currentStreak).toBe(1);
  });

  it("invalid today value is ignored and server date is used as the anchor", async () => {
    setupSelectQueue(buildResultQueue());
    const resNormal = await request(buildApp()).get(
      `/xp?patientId=${PATIENT_ID}`
    );

    setupSelectQueue(buildResultQueue());
    const resInvalid = await request(buildApp()).get(
      `/xp?patientId=${PATIENT_ID}&today=not-a-date`
    );

    expect(resNormal.status).toBe(200);
    expect(resInvalid.status).toBe(200);
    // Both should produce the same streak since the invalid date falls back to
    // the server date (both are anchored to 2026-07-01).
    expect(resInvalid.body.currentStreak).toBe(resNormal.body.currentStreak);
  });

  /**
   * Streak-reset scenario: days D-7 through D-5 complete, D-4 MISSING,
   * days D-3 through D-1 complete, today (D-0) incomplete.
   *
   * The streak loop must stop at the gap, so the result is 3 (D-1, D-2, D-3),
   * not 6 or 7.
   */
  it("resets streak to 3 when D-4 is missing after 3 prior complete days", async () => {
    // Anchor = 2026-07-01 (today, incomplete)
    // Recent streak:  D-1=2026-06-30, D-2=2026-06-29, D-3=2026-06-28  ✓
    // Gap:            D-4=2026-06-27                                    ✗
    // Older block:    D-5=2026-06-26, D-6=2026-06-25, D-7=2026-06-24  ✓
    const recentDates = [
      { date: "2026-06-30" },
      { date: "2026-06-29" },
      { date: "2026-06-28" },
    ];
    // All dates visible in the streak window (D-4 intentionally absent)
    const streakWindowDates = [
      { date: "2026-06-30" },
      { date: "2026-06-29" },
      { date: "2026-06-28" },
      // 2026-06-27 is missing — this is the gap
      { date: "2026-06-26" },
      { date: "2026-06-25" },
      { date: "2026-06-24" },
    ];

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly
      [{ total: 300 }],
      [{ total: 150 }],
      [{ total: 300 }],
      // 4-6: water/exercise/calorie for current week
      recentDates,
      recentDates,
      recentDates,
      // 7-9: water/exercise/calorie for current month
      recentDates,
      recentDates,
      recentDates,
      // 10-12: water/exercise/calorie for streak window
      streakWindowDates,
      streakWindowDates,
      streakWindowDates,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    // Streak starts from D-1 (today is incomplete) and breaks at D-4 (missing)
    expect(res.body.currentStreak).toBe(3);
  });

  /**
   * Break-at-yesterday scenario: today (D-0) is complete but yesterday (D-1)
   * is missing. The streak must be exactly 1 — counting today only.
   */
  it("returns streak=1 when today is complete but yesterday is the break point", async () => {
    // Anchor = 2026-07-01 (today IS complete)
    // D-1=2026-06-30 is missing — break immediately after today
    // D-2=2026-06-29 and further are complete, but unreachable past the gap
    const todayDate = [{ date: "2026-07-01" }];
    const olderDates = [
      { date: "2026-07-01" },
      // 2026-06-30 absent — gap after today
      { date: "2026-06-29" },
      { date: "2026-06-28" },
    ];

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly
      [{ total: 50 }],
      [{ total: 50 }],
      [{ total: 50 }],
      // 4-6: water/exercise/calorie for current week (today only)
      todayDate,
      todayDate,
      todayDate,
      // 7-9: water/exercise/calorie for current month
      olderDates,
      olderDates,
      olderDates,
      // 10-12: water/exercise/calorie for streak window
      olderDates,
      olderDates,
      olderDates,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    // Today is complete so startFrom=0; D-1 is missing so the loop stops → streak=1
    expect(res.body.currentStreak).toBe(1);
    expect(res.body.todayGoals.water).toBe(true);
    expect(res.body.todayGoals.exercise).toBe(true);
    expect(res.body.todayGoals.nutrition).toBe(true);
  });

  /**
   * Long-break catch-up scenario: patient was inactive for 15 days, then
   * completed 4 consecutive days (D-4 through D-1). Today (D-0) is incomplete.
   *
   * Pre-gap data (D-20 through D-16) must NOT bleed into the streak count.
   * Expected streak: 4.
   */
  it("returns streak=4 after a 15-day inactivity gap followed by 4 consecutive catch-up days", async () => {
    // Anchor = 2026-07-01 (today, incomplete)
    // Recent streak: D-1=2026-06-30, D-2=2026-06-29, D-3=2026-06-28, D-4=2026-06-27 ✓
    // Gap:           D-5=2026-06-26 through D-15=2026-06-16               ✗ (10+ days)
    // Old block:     D-16=2026-06-15 through D-20=2026-06-11               ✓
    const catchUpDates = [
      { date: "2026-06-30" },
      { date: "2026-06-29" },
      { date: "2026-06-28" },
      { date: "2026-06-27" },
    ];
    // Streak window data: recent 4 + old 5 before the gap (gap absent)
    const streakWindowDates = [
      { date: "2026-06-30" },
      { date: "2026-06-29" },
      { date: "2026-06-28" },
      { date: "2026-06-27" },
      // 2026-06-26 through 2026-06-16 are absent — the 10+ day gap
      { date: "2026-06-15" },
      { date: "2026-06-14" },
      { date: "2026-06-13" },
      { date: "2026-06-12" },
      { date: "2026-06-11" },
    ];

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly
      [{ total: 200 }],
      [{ total: 100 }],
      [{ total: 200 }],
      // 4-6: water/exercise/calorie for current week
      catchUpDates,
      catchUpDates,
      catchUpDates,
      // 7-9: water/exercise/calorie for current month
      catchUpDates,
      catchUpDates,
      catchUpDates,
      // 10-12: water/exercise/calorie for streak window
      streakWindowDates,
      streakWindowDates,
      streakWindowDates,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    // Streak starts from D-1 (today incomplete), counts D-1..D-4, breaks at
    // D-5 (missing) — the pre-gap days must not inflate the count.
    expect(res.body.currentStreak).toBe(4);
  });

  /**
   * 365-day window boundary: the streak window covers exactly 365 days back
   * from the anchor. A patient with 365 consecutive complete days (D-1 through
   * D-365, today incomplete) should report streak=365. The loop must reach the
   * window boundary without going past it.
   */
  it("returns streak=365 when all 365 days in the window are consecutively complete", async () => {
    // Build 365 date strings: D-1 = 2026-06-30 down to D-365 = 2025-07-01
    // (anchor 2026-07-01 minus 365 days = 2025-07-01)
    const anchor = new Date("2026-07-01T12:00:00.000Z");
    const allWindowDates: { date: string }[] = [];
    for (let i = 1; i <= 365; i++) {
      const d = new Date(anchor);
      d.setUTCDate(anchor.getUTCDate() - i);
      allWindowDates.push({ date: d.toISOString().split("T")[0]! });
    }

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly
      [{ total: 365 * 50 }],
      [{ total: 150 }],
      [{ total: 150 }],
      // 4-6: water/exercise/calorie for current week (today absent, recent week complete)
      allWindowDates.slice(0, 7),
      allWindowDates.slice(0, 7),
      allWindowDates.slice(0, 7),
      // 7-9: water/exercise/calorie for current month
      allWindowDates.slice(0, 30),
      allWindowDates.slice(0, 30),
      allWindowDates.slice(0, 30),
      // 10-12: water/exercise/calorie for full streak window (all 365 days)
      allWindowDates,
      allWindowDates,
      allWindowDates,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    // All 365 days in the window are complete, today is not → streak = 365.
    // The loop boundary at i=365 is inclusive, so the window-edge day is counted.
    expect(res.body.currentStreak).toBe(365);
  });

  /**
   * Boundary + pre-window noise: same as above but old data from BEFORE the
   * 365-day window exists in the Sets (simulating the DB returning data outside
   * the window if the filter were missing). The streak must still cap at 365
   * because the loop itself stops at i=365.
   *
   * In practice the DB query filters to gte(streakWindowStart), but the loop
   * cap is the final safeguard. This test confirms that even if phantom dates
   * existed, the loop would not count past 365.
   */
  it("caps streak at 365 even when pre-window phantom dates are present in the set", async () => {
    const anchor = new Date("2026-07-01T12:00:00.000Z");
    // 365 real window dates (D-1 … D-365)
    const windowDates: { date: string }[] = [];
    for (let i = 1; i <= 365; i++) {
      const d = new Date(anchor);
      d.setUTCDate(anchor.getUTCDate() - i);
      windowDates.push({ date: d.toISOString().split("T")[0]! });
    }
    // Add a phantom date one day beyond the window (D-366)
    const phantomDate = new Date(anchor);
    phantomDate.setUTCDate(anchor.getUTCDate() - 366);
    const allDatesWithPhantom = [
      ...windowDates,
      { date: phantomDate.toISOString().split("T")[0]! },
    ];

    setupSelectQueue([
      [{ total: 365 * 50 }],
      [{ total: 150 }],
      [{ total: 150 }],
      windowDates.slice(0, 7),
      windowDates.slice(0, 7),
      windowDates.slice(0, 7),
      windowDates.slice(0, 30),
      windowDates.slice(0, 30),
      windowDates.slice(0, 30),
      allDatesWithPhantom,
      allDatesWithPhantom,
      allDatesWithPhantom,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    // The loop runs i=1..365 only, so pre-window day D-366 cannot be reached.
    expect(res.body.currentStreak).toBe(365);
  });

  /**
   * Partial-today scenario: today has water ✓ and exercise ✓ but no calories ✗.
   * The todayGoals projection must reflect the missing goal individually, and the
   * streak must not be inflated — it behaves identically to the D-1-only case
   * (streak=1) because today is incomplete and the anchor shifts to yesterday.
   */
  it("todayGoals reflects partial completion and streak is not inflated when today has water+exercise but no calories", async () => {
    // Today (2026-07-01): water ✓, exercise ✓, calories ✗
    // D-1 (2026-06-30): all three goals ✓ — streak anchor
    // D-2 and beyond: no data — streak breaks immediately after D-1
    const todayAndD1Water    = [{ date: "2026-07-01" }, { date: "2026-06-30" }];
    const todayAndD1Exercise = [{ date: "2026-07-01" }, { date: "2026-06-30" }];
    const d1OnlyCalories     = [{ date: "2026-06-30" }]; // today intentionally absent

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly (D-1 earned 50 XP)
      [{ total: 50 }],
      [{ total: 50 }],
      [{ total: 50 }],
      // 4-6: water/exercise/calorie for current week
      todayAndD1Water,
      todayAndD1Exercise,
      d1OnlyCalories,
      // 7-9: water/exercise/calorie for current month (source of todayGoals)
      todayAndD1Water,
      todayAndD1Exercise,
      d1OnlyCalories,
      // 10-12: water/exercise/calorie for streak window
      todayAndD1Water,
      todayAndD1Exercise,
      d1OnlyCalories,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);

    // todayGoals must reflect each goal independently
    expect(res.body.todayGoals.water).toBe(true);
    expect(res.body.todayGoals.exercise).toBe(true);
    expect(res.body.todayGoals.nutrition).toBe(false);

    // Today is incomplete (no calories) → streak starts from D-1 (2026-06-30).
    // D-1 has all three goals → streak=1. D-2 is absent → loop breaks.
    // Result must equal the D-1-only baseline — not inflated by today's partial data.
    expect(res.body.currentStreak).toBe(1);
  });

  /**
   * Daily-bonus gate: a day with water ✓ and exercise ✓ but NO calorie entry
   * must NOT be counted as a completed day, so `currentWeekGoalsCompleted`
   * stays at 0 and the totalXp stored in xpEntriesTable does not include the
   * 50-XP daily bonus for that day.
   *
   * This is a direct regression guard for the AND-gate in the weekly
   * goals-completed counter: if the implementation switched to OR, a two-of-three
   * day would be counted and inflate both `currentWeekGoalsCompleted` and the
   * bonus XP total.
   */
  it("does not award daily bonus when only two goals (water + exercise) are completed — calories missing", async () => {
    // Anchor: 2026-07-01 (Tuesday). The patient logged water and exercise today
    // but has NO calorie entry. The stored totalXp reflects only activity-level
    // XP (e.g. 2 × 50 = 100 from the two activity check-ins), with NO daily bonus.
    const waterAndExerciseOnly = [{ date: "2026-07-01" }];
    const noCalories: unknown[] = [];

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly
      // 100 XP stored: two activity entries at 50 XP each, no daily bonus.
      [{ total: 100 }],
      [{ total: 100 }],
      [{ total: 100 }],
      // 4-6: water/exercise/calorie for current week
      waterAndExerciseOnly, // water ✓
      waterAndExerciseOnly, // exercise ✓
      noCalories,           // calories ✗ — daily bonus must NOT be granted
      // 7-9: water/exercise/calorie for current month (used for todayGoals)
      waterAndExerciseOnly,
      waterAndExerciseOnly,
      noCalories,
      // 10-12: water/exercise/calorie for streak window
      waterAndExerciseOnly,
      waterAndExerciseOnly,
      noCalories,
    ]);

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);

    // Two activities done today, but the daily bonus requires ALL THREE goals.
    // currentWeekGoalsCompleted must be 0 — the partial day must NOT count.
    expect(res.body.currentWeekGoalsCompleted).toBe(0);

    // todayGoals must correctly reflect which goals are done vs. missing
    expect(res.body.todayGoals.water).toBe(true);
    expect(res.body.todayGoals.exercise).toBe(true);
    expect(res.body.todayGoals.nutrition).toBe(false);

    // totalXp is whatever xpEntriesTable holds (no bonus was recorded)
    expect(res.body.totalXp).toBe(100);

    // Today is incomplete (no calories) and there are no prior complete days,
    // so the streak must be 0 — not inflated by the partial activity.
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Weekly-bonus gate: a FULL 7-day week where every day has water ✓ and
   * exercise ✓ but NO calorie entry must NOT trigger the weekly bonus.
   *
   * To obtain an exact 7-day week we use `today=2026-07-04` (Saturday).
   * 2026-07-01 is a Wednesday (getUTCDay()=3), so:
   *   Jul 2 = Thursday, Jul 3 = Friday, Jul 4 = Saturday (getUTCDay()=6).
   * startOfWeek = Jul 4 − 6 = Jun 28 (Sunday).
   * The week therefore spans all 7 days: Jun 28, Jun 29, Jun 30,
   * Jul 1, Jul 2, Jul 3, Jul 4.
   *
   * The patient completes water + exercise on every one of those 7 days but
   * logs no calories on any day. Because the AND gate requires ALL THREE goals
   * to count a day as complete, `currentWeekGoalsCompleted` must be 0 for
   * every day. No weekly bonus (50 XP) must appear in weeklyXp or monthlyXp.
   *
   * This is a regression guard against an OR-gate implementation that would
   * count two-of-three days as complete and inflate both the goal counter and
   * the weekly/monthly bonus XP totals.
   */
  it("does not award weekly bonus when water + exercise are completed on all 7 days but calories are always missing", async () => {
    // Client anchor: 2026-07-04 (Saturday, end of week).
    // Week: Sun 2026-06-28 through Sat 2026-07-04 — exactly 7 days.
    // Water ✓ and exercise ✓ on every day; calorie entries: none.
    const allSevenDays = [
      { date: "2026-06-28" }, // Sunday
      { date: "2026-06-29" }, // Monday
      { date: "2026-06-30" }, // Tuesday
      { date: "2026-07-01" }, // Wednesday
      { date: "2026-07-02" }, // Thursday
      { date: "2026-07-03" }, // Friday
      { date: "2026-07-04" }, // Saturday (anchor / today)
    ];
    const noCalories: unknown[] = [];

    // Stored XP reflects activity-only entries — no weekly bonus recorded.
    // 7 days × 2 goals × 50 XP = 700 XP from activities.
    // The 50-XP weekly bonus was NOT awarded because no day was fully complete.
    const WEEKLY_BONUS_XP = 50;
    const ACTIVITY_ONLY_XP = 700; // 7 × 2 × 50
    const ACTIVITY_ONLY_MONTHLY_XP = ACTIVITY_ONLY_XP; // same window this month

    setupSelectQueue([
      // 1-3: xpEntries total / weekly / monthly
      [{ total: ACTIVITY_ONLY_XP }],
      [{ total: ACTIVITY_ONLY_XP }],
      [{ total: ACTIVITY_ONLY_MONTHLY_XP }],
      // 4-6: water/exercise/calorie for current week (all 7 days)
      allSevenDays, // water ✓ every day
      allSevenDays, // exercise ✓ every day
      noCalories,   // calories ✗ every day — weekly bonus must NOT be granted
      // 7-9: water/exercise/calorie for current month (used for todayGoals)
      allSevenDays,
      allSevenDays,
      noCalories,
      // 10-12: water/exercise/calorie for streak window
      allSevenDays,
      allSevenDays,
      noCalories,
    ]);

    const res = await request(buildApp()).get(
      `/xp?patientId=${PATIENT_ID}&today=2026-07-04`
    );

    expect(res.status).toBe(200);

    // Every day has only 2-of-3 goals (water + exercise, no calories).
    // The AND gate must reject all 7 days — none count as "complete".
    expect(res.body.currentWeekGoalsCompleted).toBe(0);

    // weeklyXp must match the activity-only total stored in xpEntriesTable.
    // A 50-XP weekly bonus must NOT be present in the weekly window.
    expect(res.body.weeklyXp).toBe(ACTIVITY_ONLY_XP);
    expect(res.body.weeklyXp).not.toBeGreaterThanOrEqual(
      ACTIVITY_ONLY_XP + WEEKLY_BONUS_XP
    );

    // monthlyXp must also not include the weekly bonus — the same partial data
    // appears in the monthly window and no complete day was recorded there either.
    expect(res.body.monthlyXp).toBe(ACTIVITY_ONLY_MONTHLY_XP);
    expect(res.body.monthlyXp).not.toBeGreaterThanOrEqual(
      ACTIVITY_ONLY_MONTHLY_XP + WEEKLY_BONUS_XP
    );

    // Anchor day (Jul 4) has water and exercise but no nutrition
    expect(res.body.todayGoals.water).toBe(true);
    expect(res.body.todayGoals.exercise).toBe(true);
    expect(res.body.todayGoals.nutrition).toBe(false);

    // Today is incomplete, and no prior day has all 3 goals → streak must be 0
    expect(res.body.currentStreak).toBe(0);
  });

  it("returns 400 when patientId is missing", async () => {
    const res = await request(buildApp()).get("/xp");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 401 when auth fails", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "Unauthorized",
      status: 401,
    });

    const res = await request(buildApp()).get(`/xp?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(401);
  });
});

// ── GET /xp — currentMonthPerfect gate ───────────────────────────────────────

/**
 * These tests pin the monthly perfect-month bonus gate.
 *
 * Anchor: 2026-07-15 (mid-month) so the month window covers July 1–15.
 * All `currentMonthPerfect` logic is driven by the month data (select calls 7–9).
 */
describe("GET /xp — currentMonthPerfect", () => {
  const ANCHOR = "2026-07-15";

  /** Build { date } rows for every day of July 1–15, optionally excluding one. */
  function julDates(exclude?: string): { date: string }[] {
    const dates: { date: string }[] = [];
    for (let d = 1; d <= 15; d++) {
      const ds = `2026-07-${String(d).padStart(2, "0")}`;
      if (ds !== exclude) dates.push({ date: ds });
    }
    return dates;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${ANCHOR}T12:00:00.000Z`));
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * All 15 days of July have water and exercise, but July 10 is missing a
   * calorie entry. The AND-gate in currentMonthPerfect must detect the gap and
   * keep the flag false — even though two of the three goals were logged every day.
   */
  it("currentMonthPerfect is false when all days have water+exercise but one day is missing calories", async () => {
    const allDays = julDates();
    const missingJul10 = julDates("2026-07-10");

    setupSelectQueue([
      // 1-3: xpEntries total/weekly/monthly
      [{ total: 0 }],
      [{ total: 0 }],
      [{ total: 0 }],
      // 4-6: water/exercise/calorie for current week
      allDays,
      allDays,
      missingJul10,
      // 7-9: water/exercise/calorie for current month (drives currentMonthPerfect)
      allDays,       // water: every day ✓
      allDays,       // exercise: every day ✓
      missingJul10,  // calories: July 10 absent ✗
      // 10-12: water/exercise/calorie for streak window
      allDays,
      allDays,
      missingJul10,
    ]);

    const res = await request(buildApp()).get(
      `/xp?patientId=${PATIENT_ID}&today=${ANCHOR}`
    );

    expect(res.status).toBe(200);
    // July 10 has no calorie entry → month is not perfect
    expect(res.body.currentMonthPerfect).toBe(false);
  });

  /**
   * Boundary case: July 2–15 are fully complete (all three goals), but
   * July 1 — the very first day of the month — is missing a calorie entry.
   *
   * The loop in currentMonthPerfect starts at startOfMonth (July 1), so the
   * boundary day is the first one checked. A correct implementation catches it
   * immediately and returns false.
   */
  it("currentMonthPerfect is false when the first day of the month is missing one goal", async () => {
    const allDays = julDates();
    const missingJul1 = julDates("2026-07-01"); // July 2–15 only

    setupSelectQueue([
      // 1-3: xpEntries total/weekly/monthly
      [{ total: 0 }],
      [{ total: 0 }],
      [{ total: 0 }],
      // 4-6: water/exercise/calorie for current week
      allDays,
      allDays,
      missingJul1,
      // 7-9: water/exercise/calorie for current month (drives currentMonthPerfect)
      allDays,      // water: all days including July 1 ✓
      allDays,      // exercise: all days including July 1 ✓
      missingJul1,  // calories: July 1 absent ✗ — boundary day fails
      // 10-12: water/exercise/calorie for streak window
      allDays,
      allDays,
      missingJul1,
    ]);

    const res = await request(buildApp()).get(
      `/xp?patientId=${PATIENT_ID}&today=${ANCHOR}`
    );

    expect(res.status).toBe(200);
    // The loop hits July 1 first; calories are missing → currentMonthPerfect = false
    expect(res.body.currentMonthPerfect).toBe(false);
  });
});
