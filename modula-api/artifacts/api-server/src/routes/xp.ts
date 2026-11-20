import { Router } from "express";
import { eq, sql, gte, and } from "drizzle-orm";
import { db, xpEntriesTable, patientsTable, waterEntriesTable, exerciseEntriesTable, calorieEntriesTable } from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess } from "../lib/auth-helpers";

const router = Router();

router.get("/xp", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;

  let effectivePatientId = patientId;
  if (user.role === "patient" && !patientId) {
    const p = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    effectivePatientId = p[0]?.id;
  } else if (user.role !== "patient" && effectivePatientId) {
    const allowed = await ensurePatientAccess(user, effectivePatientId, authResult.clinicId);
    if (!allowed) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
  }

  if (!effectivePatientId) {
    res.status(400).json({ error: "patientId required" });
    return;
  }

  const now = new Date();

  // Accept client's local date to avoid UTC vs device-timezone off-by-one errors.
  // Validate pattern then semantic validity before trusting the value.
  const serverToday = now.toISOString().split("T")[0]!;
  let clientToday = serverToday;
  if (typeof req.query.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.today)) {
    const parsed = new Date(`${req.query.today}T00:00:00.000Z`);
    if (!isNaN(parsed.getTime()) && parsed.toISOString().startsWith(req.query.today)) {
      clientToday = req.query.today;
    }
  }

  // Build a Date object anchored to the client's local midnight (treated as UTC midnight
  // for relative-day arithmetic; only the date string matters for DB comparisons).
  const anchorDate = new Date(`${clientToday}T00:00:00.000Z`);

  const weekAgo = new Date(anchorDate);
  weekAgo.setUTCDate(anchorDate.getUTCDate() - 7);
  const monthAgo = new Date(anchorDate);
  monthAgo.setUTCDate(anchorDate.getUTCDate() - 30);

  const [totalResult, weeklyResult, monthlyResult] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${xpEntriesTable.points}), 0)` })
      .from(xpEntriesTable)
      .where(eq(xpEntriesTable.patientId, effectivePatientId)),
    db
      .select({ total: sql<number>`coalesce(sum(${xpEntriesTable.points}), 0)` })
      .from(xpEntriesTable)
      .where(
        sql`${xpEntriesTable.patientId} = ${effectivePatientId} AND ${xpEntriesTable.date} >= ${weekAgo.toISOString().split("T")[0]}`
      ),
    db
      .select({ total: sql<number>`coalesce(sum(${xpEntriesTable.points}), 0)` })
      .from(xpEntriesTable)
      .where(
        sql`${xpEntriesTable.patientId} = ${effectivePatientId} AND ${xpEntriesTable.date} >= ${monthAgo.toISOString().split("T")[0]}`
      ),
  ]);

  const totalXp = Number(totalResult[0]?.total ?? 0);
  const weeklyXp = Number(weeklyResult[0]?.total ?? 0);
  const monthlyXp = Number(monthlyResult[0]?.total ?? 0);

  const level = Math.floor(totalXp / 500) + 1;

  // Current week goals completed: count days where patient has ≥1 water + ≥1 exercise + ≥1 meal
  const startOfWeek = new Date(anchorDate);
  startOfWeek.setUTCDate(anchorDate.getUTCDate() - anchorDate.getUTCDay());
  const startOfWeekStr = startOfWeek.toISOString().split("T")[0]!;

  const [weekWater, weekExercise, weekMeal] = await Promise.all([
    db.select({ date: waterEntriesTable.date }).from(waterEntriesTable)
      .where(and(eq(waterEntriesTable.patientId, effectivePatientId), gte(waterEntriesTable.date, startOfWeekStr))),
    db.select({ date: exerciseEntriesTable.date }).from(exerciseEntriesTable)
      .where(and(eq(exerciseEntriesTable.patientId, effectivePatientId), gte(exerciseEntriesTable.date, startOfWeekStr))),
    db.select({ date: calorieEntriesTable.date }).from(calorieEntriesTable)
      .where(and(eq(calorieEntriesTable.patientId, effectivePatientId), gte(calorieEntriesTable.date, startOfWeekStr))),
  ]);

  const waterDates = new Set(weekWater.map((r) => r.date));
  const exerciseDates = new Set(weekExercise.map((r) => r.date));
  const mealDates = new Set(weekMeal.map((r) => r.date));

  const allDates = new Set([...waterDates, ...exerciseDates, ...mealDates]);
  let currentWeekGoalsCompleted = 0;
  for (const date of allDates) {
    if (waterDates.has(date) && exerciseDates.has(date) && mealDates.has(date)) {
      currentWeekGoalsCompleted++;
    }
  }

  // Current month perfect: every day this month has all 3 goals
  const startOfMonth = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1));
  const startOfMonthStr = startOfMonth.toISOString().split("T")[0]!;
  const todayStr = clientToday;

  const [monthWater, monthExercise, monthMeal] = await Promise.all([
    db.select({ date: waterEntriesTable.date }).from(waterEntriesTable)
      .where(and(eq(waterEntriesTable.patientId, effectivePatientId), gte(waterEntriesTable.date, startOfMonthStr))),
    db.select({ date: exerciseEntriesTable.date }).from(exerciseEntriesTable)
      .where(and(eq(exerciseEntriesTable.patientId, effectivePatientId), gte(exerciseEntriesTable.date, startOfMonthStr))),
    db.select({ date: calorieEntriesTable.date }).from(calorieEntriesTable)
      .where(and(eq(calorieEntriesTable.patientId, effectivePatientId), gte(calorieEntriesTable.date, startOfMonthStr))),
  ]);

  const mWaterDates = new Set(monthWater.map((r) => r.date));
  const mExerciseDates = new Set(monthExercise.map((r) => r.date));
  const mMealDates = new Set(monthMeal.map((r) => r.date));

  let currentMonthPerfect = false;
  const allMonthDates = new Set([...mWaterDates, ...mExerciseDates, ...mMealDates]);
  if (allMonthDates.size > 0) {
    let hasMissingDay = false;
    for (let d = new Date(startOfMonth); d.toISOString().split("T")[0]! <= todayStr; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0]!;
      if (!mWaterDates.has(ds) || !mExerciseDates.has(ds) || !mMealDates.has(ds)) {
        hasMissingDay = true;
        break;
      }
    }
    currentMonthPerfect = !hasMissingDay;
  }

  // Today's goals
  const todayGoals = {
    water: mWaterDates.has(todayStr),
    exercise: mExerciseDates.has(todayStr),
    nutrition: mMealDates.has(todayStr),
  };

  // Streak: consecutive days (going back from yesterday or today) with all 3 goals
  // We use the month data for recent days and extend back if needed
  const streakWindowStart = new Date(anchorDate);
  streakWindowStart.setUTCDate(anchorDate.getUTCDate() - 365);
  const streakWindowStartStr = streakWindowStart.toISOString().split("T")[0]!;

  const [streakWater, streakExercise, streakMeal] = await Promise.all([
    db.select({ date: waterEntriesTable.date }).from(waterEntriesTable)
      .where(and(eq(waterEntriesTable.patientId, effectivePatientId), gte(waterEntriesTable.date, streakWindowStartStr))),
    db.select({ date: exerciseEntriesTable.date }).from(exerciseEntriesTable)
      .where(and(eq(exerciseEntriesTable.patientId, effectivePatientId), gte(exerciseEntriesTable.date, streakWindowStartStr))),
    db.select({ date: calorieEntriesTable.date }).from(calorieEntriesTable)
      .where(and(eq(calorieEntriesTable.patientId, effectivePatientId), gte(calorieEntriesTable.date, streakWindowStartStr))),
  ]);

  const sWaterDates = new Set(streakWater.map((r) => r.date));
  const sExerciseDates = new Set(streakExercise.map((r) => r.date));
  const sMealDates = new Set(streakMeal.map((r) => r.date));

  function isDayComplete(dateStr: string): boolean {
    return sWaterDates.has(dateStr) && sExerciseDates.has(dateStr) && sMealDates.has(dateStr);
  }

  // Find the earliest date that has ANY entry — once we walk past it, no complete
  // day can follow, so we can stop iterating early instead of walking all 365 days.
  const allEntryDates = [...sWaterDates, ...sExerciseDates, ...sMealDates];
  const earliestEntryDate = allEntryDates.length > 0
    ? allEntryDates.reduce((min, d) => (d < min ? d : min))
    : null;

  let currentStreak = 0;
  // Start counting from today; if today isn't complete, start from yesterday
  const startFrom = isDayComplete(todayStr) ? 0 : 1;
  for (let i = startFrom; i <= 365; i++) {
    const d = new Date(anchorDate);
    d.setUTCDate(anchorDate.getUTCDate() - i);
    const ds = d.toISOString().split("T")[0]!;
    // Short-circuit: no entries exist before this date, so streak is already broken
    if (earliestEntryDate === null || ds < earliestEntryDate) {
      break;
    }
    if (isDayComplete(ds)) {
      currentStreak++;
    } else {
      break;
    }
  }

  res.json({
    patientId: effectivePatientId,
    totalXp,
    level,
    weeklyXp,
    monthlyXp,
    currentWeekGoalsCompleted,
    currentMonthPerfect,
    currentStreak,
    todayGoals,
  });
});

router.get("/xp/heatmap", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  if (!from || !to) {
    res.status(400).json({ error: "from and to date params are required" });
    return;
  }

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  if (isNaN(fromMs) || isNaN(toMs)) {
    res.status(400).json({ error: "from and to must be valid dates (YYYY-MM-DD)" });
    return;
  }

  const rangeDays = (toMs - fromMs) / (1000 * 60 * 60 * 24);

  if (rangeDays > 366) {
    res.status(400).json({ error: "Date range must not exceed 366 days" });
    return;
  }

  let effectivePatientId: number | undefined;

  if (user.role === "patient") {
    const p = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    effectivePatientId = p[0]?.id;
  } else {
    const requestedId = req.query.patientId ? Number(req.query.patientId) : undefined;
    if (!requestedId) {
      res.status(400).json({ error: "patientId required" });
      return;
    }
    const patient = await ensurePatientAccess(user, requestedId, authResult.clinicId);
    if (!patient) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    effectivePatientId = patient.id;
  }

  if (!effectivePatientId) {
    res.status(400).json({ error: "Patient record not found" });
    return;
  }

  const { lte } = await import("drizzle-orm");

  const [waterRows, exerciseRows, calorieRows] = await Promise.all([
    db.select({ date: waterEntriesTable.date })
      .from(waterEntriesTable)
      .where(and(
        eq(waterEntriesTable.patientId, effectivePatientId),
        gte(waterEntriesTable.date, from),
        lte(waterEntriesTable.date, to),
      )),
    db.select({ date: exerciseEntriesTable.date })
      .from(exerciseEntriesTable)
      .where(and(
        eq(exerciseEntriesTable.patientId, effectivePatientId),
        gte(exerciseEntriesTable.date, from),
        lte(exerciseEntriesTable.date, to),
      )),
    db.select({ date: calorieEntriesTable.date })
      .from(calorieEntriesTable)
      .where(and(
        eq(calorieEntriesTable.patientId, effectivePatientId),
        gte(calorieEntriesTable.date, from),
        lte(calorieEntriesTable.date, to),
      )),
  ]);

  const waterDates = new Set(waterRows.map((r) => r.date));
  const exerciseDates = new Set(exerciseRows.map((r) => r.date));
  const calorieDates = new Set(calorieRows.map((r) => r.date));

  const allActiveDates = new Set([...waterDates, ...exerciseDates, ...calorieDates]);

  const result: { date: string; level: 0 | 1 | 2 }[] = [];
  const cursor = new Date(from);
  const end = new Date(to);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().split("T")[0]!;
    const hasWater = waterDates.has(dateStr);
    const hasExercise = exerciseDates.has(dateStr);
    const hasCalories = calorieDates.has(dateStr);

    if (allActiveDates.has(dateStr)) {
      const goalsCount = (hasWater ? 1 : 0) + (hasExercise ? 1 : 0) + (hasCalories ? 1 : 0);
      result.push({ date: dateStr, level: goalsCount === 3 ? 2 : 1 });
    } else {
      result.push({ date: dateStr, level: 0 });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  res.json(result);
});

router.get("/xp/history", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const { desc } = await import("drizzle-orm");

  let effectivePatientId = patientId;
  if (user.role === "patient" && !patientId) {
    const p = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    effectivePatientId = p[0]?.id;
  } else if (user.role !== "patient" && effectivePatientId) {
    const allowed = await ensurePatientAccess(user, effectivePatientId, authResult.clinicId);
    if (!allowed) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
  }

  if (!effectivePatientId) {
    res.status(400).json({ error: "patientId required" });
    return;
  }

  const rows = await db
    .select()
    .from(xpEntriesTable)
    .where(eq(xpEntriesTable.patientId, effectivePatientId))
    .orderBy(desc(xpEntriesTable.createdAt))
    .limit(limit);

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

export default router;
