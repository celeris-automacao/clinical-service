import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ─────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
  },
  patientsTable: {},
  xpEntriesTable: {},
  waterEntriesTable: {},
  exerciseEntriesTable: {},
  calorieEntriesTable: {},
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  ensurePatientAccess: vi.fn().mockResolvedValue({ id: 5 }),
  ACCESS_TOKEN_PREFIX: "clinic_pat_",
  hashAccessToken: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import xpRouter from "../xp";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
 * Creates a select chain that resolves to `data` at the terminal `.then` /
 * `.limit()` call. Matches the Drizzle-ORM chained query style used in the
 * route handlers.
 */
function makeSelectChain(data: unknown): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(data);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(data).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(data).catch(handler);
  return chain;
}

/**
 * Stubs all 12 `db.select()` calls that `GET /xp` issues, in the exact order
 * the route executes them:
 *
 *   [1]  total XP sum
 *   [2]  weekly XP sum
 *   [3]  monthly XP sum
 *   [4]  week water entries
 *   [5]  week exercise entries
 *   [6]  week meal entries
 *   [7]  month water entries
 *   [8]  month exercise entries
 *   [9]  month meal entries
 *   [10] streak-window water entries
 *   [11] streak-window exercise entries
 *   [12] streak-window meal entries
 */
function stubXpSelects({
  weekWaterDates = [] as string[],
  weekExerciseDates = [] as string[],
  weekMealDates = [] as string[],
  monthWaterDates = [] as string[],
  monthExerciseDates = [] as string[],
  monthMealDates = [] as string[],
  streakWaterDates = [] as string[],
  streakExerciseDates = [] as string[],
  streakMealDates = [] as string[],
} = {}) {
  const selectMock = db.select as ReturnType<typeof vi.fn>;

  // [1-3] XP aggregates
  selectMock.mockReturnValueOnce(makeSelectChain([{ total: 0 }]));
  selectMock.mockReturnValueOnce(makeSelectChain([{ total: 0 }]));
  selectMock.mockReturnValueOnce(makeSelectChain([{ total: 0 }]));

  // [4-6] current-week activity
  selectMock.mockReturnValueOnce(
    makeSelectChain(weekWaterDates.map((date) => ({ date })))
  );
  selectMock.mockReturnValueOnce(
    makeSelectChain(weekExerciseDates.map((date) => ({ date })))
  );
  selectMock.mockReturnValueOnce(
    makeSelectChain(weekMealDates.map((date) => ({ date })))
  );

  // [7-9] current-month activity
  selectMock.mockReturnValueOnce(
    makeSelectChain(monthWaterDates.map((date) => ({ date })))
  );
  selectMock.mockReturnValueOnce(
    makeSelectChain(monthExerciseDates.map((date) => ({ date })))
  );
  selectMock.mockReturnValueOnce(
    makeSelectChain(monthMealDates.map((date) => ({ date })))
  );

  // [10-12] streak-window activity (used by isDayComplete)
  selectMock.mockReturnValueOnce(
    makeSelectChain(streakWaterDates.map((date) => ({ date })))
  );
  selectMock.mockReturnValueOnce(
    makeSelectChain(streakExerciseDates.map((date) => ({ date })))
  );
  selectMock.mockReturnValueOnce(
    makeSelectChain(streakMealDates.map((date) => ({ date })))
  );
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns `count` ISO date strings (YYYY-MM-DD) going backwards from
 * `anchorDate - startOffsetDays`. Index 0 is the most recent date.
 *
 * Example: makeDates("2025-06-01", 1, 3) → ["2025-05-31", "2025-05-30", "2025-05-29"]
 */
function makeDates(anchorDateStr: string, startOffsetDays: number, count: number): string[] {
  const anchor = new Date(`${anchorDateStr}T00:00:00.000Z`);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() - (startOffsetDays + i));
    dates.push(d.toISOString().split("T")[0]!);
  }
  return dates;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /xp — streak timezone correctness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER,
    });
  });

  /**
   * Scenario: patient is in UTC-5 and logs all three goals at 23:58 local time
   * on 2025-01-15. On the server the UTC wall-clock date is already 2025-01-16,
   * but the client sends `?today=2025-01-15` to anchor the streak to the correct
   * local date.
   *
   * Expected: streak = 1 (today is complete, yesterday is not).
   */
  it("streak = 1 when patient logs goals at 23:58 local time and passes client ?today (UTC-5 scenario)", async () => {
    const localToday = "2025-01-15";

    stubXpSelects({
      weekWaterDates: [localToday],
      weekExerciseDates: [localToday],
      weekMealDates: [localToday],
      monthWaterDates: [localToday],
      monthExerciseDates: [localToday],
      monthMealDates: [localToday],
      // Streak window: only localToday has all 3 goals; yesterday (01-14) does not.
      streakWaterDates: [localToday],
      streakExerciseDates: [localToday],
      streakMealDates: [localToday],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(1);
  });

  /**
   * Scenario: patient did NOT complete all goals yesterday (2025-01-14).
   * Regardless of what `today` the client sends, the streak must be 0.
   *
   * Expected: streak = 0.
   */
  it("streak = 0 when patient did not complete goals yesterday, regardless of client ?today", async () => {
    const localToday = "2025-01-15";
    const twoDaysAgo = "2025-01-13";

    // Only 01-13 has all 3 goals; 01-14 (yesterday) and 01-15 (today) do not.
    stubXpSelects({
      weekWaterDates: [twoDaysAgo],
      weekExerciseDates: [twoDaysAgo],
      weekMealDates: [twoDaysAgo],
      monthWaterDates: [twoDaysAgo],
      monthExerciseDates: [twoDaysAgo],
      monthMealDates: [twoDaysAgo],
      streakWaterDates: [twoDaysAgo],
      streakExerciseDates: [twoDaysAgo],
      streakMealDates: [twoDaysAgo],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Scenario: patient has completed goals on three consecutive local dates
   * (01-13, 01-14, 01-15). The client is in UTC-3 and passes today=2025-01-15.
   * The server-side UTC date would be 2025-01-16 00:58, but the client's local
   * date anchors the streak correctly.
   *
   * Expected: streak = 3.
   */
  it("streak = 3 for three consecutive days when client ?today anchors to local date (UTC-3 scenario)", async () => {
    const localToday = "2025-01-15";
    const yesterday = "2025-01-14";
    const twoDaysAgo = "2025-01-13";
    const allDays = [localToday, yesterday, twoDaysAgo];

    stubXpSelects({
      weekWaterDates: allDays,
      weekExerciseDates: allDays,
      weekMealDates: allDays,
      monthWaterDates: allDays,
      monthExerciseDates: allDays,
      monthMealDates: allDays,
      streakWaterDates: allDays,
      streakExerciseDates: allDays,
      streakMealDates: allDays,
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(3);
  });

  /**
   * Scenario: patient completed goals yesterday (01-14) but NOT today (01-15).
   * The streak should still count from yesterday backwards.
   *
   * Expected: streak = 1.
   */
  it("streak = 1 when yesterday is complete but today is not yet (partial day in progress)", async () => {
    const localToday = "2025-01-15";
    const yesterday = "2025-01-14";

    stubXpSelects({
      weekWaterDates: [yesterday],
      weekExerciseDates: [yesterday],
      weekMealDates: [yesterday],
      monthWaterDates: [yesterday],
      monthExerciseDates: [yesterday],
      monthMealDates: [yesterday],
      // Streak window: only yesterday is complete; today is not.
      streakWaterDates: [yesterday],
      streakExerciseDates: [yesterday],
      streakMealDates: [yesterday],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(1);
  });

  /**
   * Scenario: patient has only two of the three required goals logged today —
   * water and exercise but no meal. The day must not count as complete.
   *
   * Expected: streak = 0 (no complete day found in either today or yesterday).
   */
  it("streak = 0 when today has only two of three goals (missing meal entry)", async () => {
    const localToday = "2025-01-15";

    stubXpSelects({
      weekWaterDates: [localToday],
      weekExerciseDates: [localToday],
      weekMealDates: [],
      monthWaterDates: [localToday],
      monthExerciseDates: [localToday],
      monthMealDates: [],
      // Streak window: today has water + exercise but no meal → not complete.
      streakWaterDates: [localToday],
      streakExerciseDates: [localToday],
      streakMealDates: [],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Scenario: an invalid or missing `?today` parameter causes the server to
   * fall back to its own UTC date. The streak calculation must still succeed
   * (not crash) — it just anchors to the server date instead.
   */
  it("returns 200 and a valid streak when ?today is absent (server-side UTC fallback)", async () => {
    // Use a wide date range that will certainly cover the server UTC date.
    const serverUTCDate = new Date().toISOString().split("T")[0]!;

    stubXpSelects({
      weekWaterDates: [serverUTCDate],
      weekExerciseDates: [serverUTCDate],
      weekMealDates: [serverUTCDate],
      monthWaterDates: [serverUTCDate],
      monthExerciseDates: [serverUTCDate],
      monthMealDates: [serverUTCDate],
      streakWaterDates: [serverUTCDate],
      streakExerciseDates: [serverUTCDate],
      streakMealDates: [serverUTCDate],
    });

    const res = await request(buildApp()).get("/xp?patientId=1");

    expect(res.status).toBe(200);
    expect(typeof res.body.currentStreak).toBe("number");
    expect(res.body.currentStreak).toBeGreaterThanOrEqual(0);
  });

  /**
   * Scenario: patient has goals on days 1, 2, (gap on day 3), 4, 5.
   * The streak must count back from today (day 5) and stop at the gap,
   * yielding streak = 2 — not 5 (days 4 and 5 form the active streak).
   *
   * Timeline (today = 2025-01-15):
   *   2025-01-11 ✓  2025-01-12 ✓  2025-01-13 ✗  2025-01-14 ✓  2025-01-15 ✓
   *
   * Expected: streak = 2.
   */
  it("streak = 2 when a gap breaks a longer run (days 1,2,gap,4,5 → only last 2 count)", async () => {
    const localToday = "2025-01-15";
    const yesterday = "2025-01-14";
    // 2025-01-13 is intentionally absent (the gap)
    const twoDaysBeforeGap = "2025-01-12";
    const threeDaysBeforeGap = "2025-01-11";

    const datesWithGoals = [
      localToday,
      yesterday,
      twoDaysBeforeGap,
      threeDaysBeforeGap,
    ];

    stubXpSelects({
      weekWaterDates: datesWithGoals,
      weekExerciseDates: datesWithGoals,
      weekMealDates: datesWithGoals,
      monthWaterDates: datesWithGoals,
      monthExerciseDates: datesWithGoals,
      monthMealDates: datesWithGoals,
      // Streak window: 2025-01-13 missing in all three activity types → gap.
      streakWaterDates: datesWithGoals,
      streakExerciseDates: datesWithGoals,
      streakMealDates: datesWithGoals,
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(2);
  });

  /**
   * Scenario: patient had a 7-day streak (2025-01-07 → 2025-01-13) but missed
   * the entire following day (2025-01-14, yesterday) and has not logged anything
   * today (2025-01-15) either. The streak must drop to 0 — not 7.
   *
   * Expected: streak = 0.
   */
  it("streak drops to 0 after missing a full day following a 7-day streak", async () => {
    const localToday = "2025-01-15";
    // yesterday = "2025-01-14" is intentionally absent

    const sevenDayStreak = [
      "2025-01-13",
      "2025-01-12",
      "2025-01-11",
      "2025-01-10",
      "2025-01-09",
      "2025-01-08",
      "2025-01-07",
    ];

    stubXpSelects({
      weekWaterDates: sevenDayStreak,
      weekExerciseDates: sevenDayStreak,
      weekMealDates: sevenDayStreak,
      monthWaterDates: sevenDayStreak,
      monthExerciseDates: sevenDayStreak,
      monthMealDates: sevenDayStreak,
      // Streak window: 2025-01-14 and 2025-01-15 are both absent → streak broken.
      streakWaterDates: sevenDayStreak,
      streakExerciseDates: sevenDayStreak,
      streakMealDates: sevenDayStreak,
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Scenario: today = 2025-02-01 (first day of February). The streak window
   * contains entries from 2025-01-31 (water + exercise, but NO meal) and
   * 2025-01-30 (all 3 goals). A partial day at a month boundary must not be
   * counted — the incomplete 2025-01-31 breaks the streak immediately.
   *
   * Expected: streak = 0.
   */
  it("streak = 0 when the day at a month boundary (2025-01-31) is missing the meal entry", async () => {
    const localToday = "2025-02-01";
    const lastDayOfJan = "2025-01-31"; // partial: water + exercise only
    const dayBeforeThat = "2025-01-30"; // complete: all 3 goals

    stubXpSelects({
      weekWaterDates: [lastDayOfJan, dayBeforeThat],
      weekExerciseDates: [lastDayOfJan, dayBeforeThat],
      weekMealDates: [dayBeforeThat], // 2025-01-31 intentionally missing meal
      monthWaterDates: [lastDayOfJan, dayBeforeThat],
      monthExerciseDates: [lastDayOfJan, dayBeforeThat],
      monthMealDates: [dayBeforeThat],
      // Streak window reflects same partial state: 2025-01-31 has no meal.
      streakWaterDates: [lastDayOfJan, dayBeforeThat],
      streakExerciseDates: [lastDayOfJan, dayBeforeThat],
      streakMealDates: [dayBeforeThat],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    // 2025-02-01 has no entries → start from yesterday (2025-01-31).
    // 2025-01-31 is partial (missing meal) → not complete → streak breaks immediately.
    // The complete 2025-01-30 is never reached.
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Scenario: patient is in UTC+12 (Auckland). Their local date is 2025-01-16
   * but the server's UTC wall-clock is still on 2025-01-15 (12 hours behind).
   *
   * The patient has all three goals logged for their "today" (2025-01-16 local).
   * They send `?today=2025-01-16` to anchor the streak to their local date.
   *
   * Without the `?today` param the server would use 2025-01-15 as the anchor,
   * see no entry for that date, and return streak = 0 — the bug this feature
   * prevents. With the correct param the streak must be > 0.
   *
   * Expected: streak = 1 (today 2025-01-16 local is complete).
   */
  it("streak = 1 for UTC+12 patient whose logged date is ahead of server UTC date", async () => {
    // Patient's local date — one day ahead of the server's UTC clock.
    const aucklandToday = "2025-01-16";

    stubXpSelects({
      weekWaterDates: [aucklandToday],
      weekExerciseDates: [aucklandToday],
      weekMealDates: [aucklandToday],
      monthWaterDates: [aucklandToday],
      monthExerciseDates: [aucklandToday],
      monthMealDates: [aucklandToday],
      // Streak window: only aucklandToday has all 3 goals completed.
      streakWaterDates: [aucklandToday],
      streakExerciseDates: [aucklandToday],
      streakMealDates: [aucklandToday],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${aucklandToday}`
    );

    expect(res.status).toBe(200);
    // Streak must be > 0 — the client's local date anchors the calculation
    // correctly, preventing a false 0 caused by UTC vs UTC+12 off-by-one.
    expect(res.body.currentStreak).toBeGreaterThan(0);
    expect(res.body.currentStreak).toBe(1);
    // todayGoals should reflect the Auckland-local date being complete.
    expect(res.body.todayGoals.water).toBe(true);
    expect(res.body.todayGoals.exercise).toBe(true);
    expect(res.body.todayGoals.nutrition).toBe(true);
  });

  /**
   * Scenario: same UTC+12 patient but they do NOT pass `?today`. The server
   * falls back to UTC date 2025-01-15, which has no logged goals — so the
   * streak appears as 0 even though the patient has completed their day.
   *
   * This test documents the known limitation and confirms the server-side
   * fallback behaviour is consistent (no crash, valid response).
   *
   * Expected: streak = 0 (server UTC anchor misses the Auckland-local entries).
   */
  it("streak = 0 for UTC+12 patient when ?today is omitted and server falls back to UTC date", async () => {
    const aucklandToday = "2025-01-16";
    const serverUTCDate = "2025-01-15"; // server is 12 hours behind Auckland

    // Goals exist only for aucklandToday, not for serverUTCDate.
    stubXpSelects({
      weekWaterDates: [aucklandToday],
      weekExerciseDates: [aucklandToday],
      weekMealDates: [aucklandToday],
      monthWaterDates: [aucklandToday],
      monthExerciseDates: [aucklandToday],
      monthMealDates: [aucklandToday],
      streakWaterDates: [aucklandToday],
      streakExerciseDates: [aucklandToday],
      streakMealDates: [aucklandToday],
    });

    // Simulate: server receives the request with no ?today param,
    // so it anchors to serverUTCDate (2025-01-15). We pass it explicitly
    // here to pin the anchor deterministically without faking system time.
    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${serverUTCDate}`
    );

    expect(res.status).toBe(200);
    // Server-side UTC anchor misses the patient's logged date — streak = 0.
    // This is the bug the mobile app's `?today=<localDate>` param prevents.
    expect(res.body.currentStreak).toBe(0);
    expect(res.body.todayGoals.water).toBe(false);
    expect(res.body.todayGoals.exercise).toBe(false);
    expect(res.body.todayGoals.nutrition).toBe(false);
  });

  /**
   * Scenario: today = 2026-01-01 (first day of a new year). The streak window
   * contains entries from 2025-12-31 (water + exercise, but NO meal) and
   * 2025-12-30 (all 3 goals). A partial day at a year boundary must not be
   * counted — the incomplete 2025-12-31 breaks the streak immediately.
   *
   * This is distinct from the month-boundary test because getUTCFullYear()
   * changes between 2025-12-31 and 2026-01-01, exercising the year-rollover
   * path in setUTCDate arithmetic.
   *
   * Expected: streak = 0.
   */
  it("streak = 0 when the day at a year boundary (2025-12-31) is missing the meal entry", async () => {
    const localToday = "2026-01-01";
    const lastDayOfYear = "2025-12-31"; // partial: water + exercise only
    const dayBeforeThat = "2025-12-30"; // complete: all 3 goals

    stubXpSelects({
      weekWaterDates: [lastDayOfYear, dayBeforeThat],
      weekExerciseDates: [lastDayOfYear, dayBeforeThat],
      weekMealDates: [dayBeforeThat], // 2025-12-31 intentionally missing meal
      monthWaterDates: [lastDayOfYear, dayBeforeThat],
      monthExerciseDates: [lastDayOfYear, dayBeforeThat],
      monthMealDates: [dayBeforeThat],
      // Streak window reflects same partial state: 2025-12-31 has no meal.
      streakWaterDates: [lastDayOfYear, dayBeforeThat],
      streakExerciseDates: [lastDayOfYear, dayBeforeThat],
      streakMealDates: [dayBeforeThat],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${localToday}`
    );

    expect(res.status).toBe(200);
    // 2026-01-01 has no entries → start from yesterday (2025-12-31).
    // 2025-12-31 is partial (missing meal) → not complete → streak breaks immediately.
    // The complete 2025-12-30 is never reached.
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Scenario: `?today` is supplied as an invalid string (not ISO format).
   * The server must reject it silently and fall back to its own UTC date,
   * returning 200 with a valid response.
   */
  it("returns 200 when ?today is an invalid date string (server falls back to UTC date)", async () => {
    const serverUTCDate = new Date().toISOString().split("T")[0]!;

    stubXpSelects({
      streakWaterDates: [serverUTCDate],
      streakExerciseDates: [serverUTCDate],
      streakMealDates: [serverUTCDate],
    });

    const res = await request(buildApp()).get(
      "/xp?patientId=1&today=not-a-date"
    );

    expect(res.status).toBe(200);
    expect(typeof res.body.currentStreak).toBe("number");
  });
});

describe("GET /xp — inactive patient edge cases", () => {
  const TODAY = "2025-06-30";

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER,
    });
  });

  /**
   * Scenario: the patient has never logged anything — all three streak-window
   * queries return empty arrays. `earliestEntryDate` is null, so the loop
   * short-circuits on its very first iteration without incrementing the counter.
   *
   * Expected: streak = 0 (loop never runs).
   */
  it("streak = 0 when patient has no entries at all (loop never runs)", async () => {
    stubXpSelects({
      // All streak window dates empty — no data whatsoever.
      streakWaterDates: [],
      streakExerciseDates: [],
      streakMealDates: [],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${TODAY}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Scenario: the patient has only logged water entries (one category only).
   * No exercise or meal entries exist in the streak window, so no day can be
   * "complete" (requires all 3). The loop starts from yesterday (today is
   * incomplete), finds the first day is not complete, and breaks immediately.
   *
   * Expected: streak = 0.
   */
  it("streak = 0 when patient has only water entries (no exercise or meal — no complete days)", async () => {
    const waterDates = [TODAY, "2025-06-29", "2025-06-28"];

    stubXpSelects({
      weekWaterDates: waterDates,
      monthWaterDates: waterDates,
      streakWaterDates: waterDates,
      streakExerciseDates: [],
      streakMealDates: [],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${TODAY}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
  });

  /**
   * Scenario: the patient was consistently active ~300 days ago (all three
   * goals completed on those days) but has not logged anything since. Today's
   * date is 2025-06-30. The streak window (365 days back) includes the old
   * entries, but yesterday (2025-06-29) and today are absent. The loop starts
   * from yesterday (today is incomplete), finds it incomplete, and breaks.
   *
   * Expected: streak = 0.
   */
  it("streak = 0 when patient had complete entries 300 days ago but has been inactive since", async () => {
    // 5 consecutive complete days ending 300 days before TODAY.
    const oldDates = makeDates(TODAY, 300, 5);

    stubXpSelects({
      streakWaterDates: oldDates,
      streakExerciseDates: oldDates,
      streakMealDates: oldDates,
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${TODAY}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
  });
});

describe("GET /xp — large backfill boundary (365+ days)", () => {
  const ANCHOR = "2025-06-30";

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER,
    });
  });

  /**
   * Scenario: today is incomplete but the 365 days immediately before today
   * are all complete (a full-year streak ending yesterday).
   *
   * The streak loop starts at i=1 (yesterday) and runs through i=365,
   * which is exactly `anchorDate - 365` — the oldest date the window fetches.
   * Every day in that range is complete, so the streak must return 365.
   *
   * Expected: streak = 365.
   */
  it("streak = 365 when 365 consecutive days are complete (today incomplete)", async () => {
    const streakDates = makeDates(ANCHOR, 1, 365);

    stubXpSelects({
      streakWaterDates: streakDates,
      streakExerciseDates: streakDates,
      streakMealDates: streakDates,
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${ANCHOR}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(365);
  });

  /**
   * Scenario: today AND the 364 days before it are all complete (365 total).
   * The streak loop starts at i=0 (today) and counts through i=364.
   *
   * Expected: streak = 365.
   */
  it("streak = 365 when today plus 364 preceding days are all complete", async () => {
    const streakDates = makeDates(ANCHOR, 0, 365);

    stubXpSelects({
      weekWaterDates: [ANCHOR],
      weekExerciseDates: [ANCHOR],
      weekMealDates: [ANCHOR],
      monthWaterDates: [ANCHOR],
      monthExerciseDates: [ANCHOR],
      monthMealDates: [ANCHOR],
      streakWaterDates: streakDates,
      streakExerciseDates: streakDates,
      streakMealDates: streakDates,
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${ANCHOR}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(365);
  });

  /**
   * Scenario: the patient has 366 consecutive days of data, but the server
   * only queries entries >= anchorDate - 365. The streak window therefore
   * contains exactly 365 complete days (i=1..365; today is incomplete).
   * The day at i=366 (anchorDate - 366) is outside the query window and
   * is absent from the streak sets, so the loop stops at the boundary.
   *
   * Expected: streak = 365 (not 366).
   */
  it("streak does not exceed 365 when data exists beyond the 365-day window", async () => {
    // The DB would filter out anything older than anchorDate - 365.
    // We simulate that by only supplying 365 days in the stub (days 1..365).
    const streakDates = makeDates(ANCHOR, 1, 365);

    stubXpSelects({
      streakWaterDates: streakDates,
      streakExerciseDates: streakDates,
      streakMealDates: streakDates,
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${ANCHOR}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(365);
  });

  /**
   * Scenario: patient has completed all goals every day for a year, but there
   * is a one-day gap at day 200 from today (today incomplete). The streak
   * starting from yesterday should stop at the gap — not count through it.
   *
   * Expected: streak = 199 (days 1..199 consecutive, gap at 200).
   */
  it("streak stops at a gap even inside a large backfill window", async () => {
    const before = makeDates(ANCHOR, 1, 199);
    const after = makeDates(ANCHOR, 201, 165);
    const streakDates = [...before, ...after];

    stubXpSelects({
      streakWaterDates: streakDates,
      streakExerciseDates: streakDates,
      streakMealDates: streakDates,
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${ANCHOR}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(199);
  });

  /**
   * Scenario: only the single day exactly at the 365-day boundary
   * (anchorDate - 365) is complete; every other day in the window is empty.
   * Today is also incomplete (startFrom = 1).
   *
   * The streak loop will walk i=1 (yesterday) first — not complete → stops.
   * Expected: streak = 0.
   */
  it("streak = 0 when only the boundary day (anchorDate - 365) is complete and all others are empty", async () => {
    const anchor = new Date(`${ANCHOR}T00:00:00.000Z`);
    const boundary = new Date(anchor);
    boundary.setUTCDate(anchor.getUTCDate() - 365);
    const boundaryStr = boundary.toISOString().split("T")[0]!;

    stubXpSelects({
      streakWaterDates: [boundaryStr],
      streakExerciseDates: [boundaryStr],
      streakMealDates: [boundaryStr],
    });

    const res = await request(buildApp()).get(
      `/xp?patientId=1&today=${ANCHOR}`
    );

    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(0);
  });
});
