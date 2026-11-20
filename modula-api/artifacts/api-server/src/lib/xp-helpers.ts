import { and, eq, gte, lte } from "drizzle-orm";
import { db, xpEntriesTable, waterEntriesTable, exerciseEntriesTable, calorieEntriesTable } from "@workspace/db";

const WEEKLY_BONUS = 50;

export async function maybeAwardXp(
  patientId: number,
  date: string,
  reason: "water" | "exercise" | "nutrition"
): Promise<void> {
  const existing = await db
    .select({ id: xpEntriesTable.id })
    .from(xpEntriesTable)
    .where(
      and(
        eq(xpEntriesTable.patientId, patientId),
        eq(xpEntriesTable.date, date),
        eq(xpEntriesTable.reason, reason)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(xpEntriesTable).values({ patientId, points: 50, reason, date });
    // After awarding any XP, check if weekly bonus should be granted too
    await maybeAwardWeeklyBonus(patientId, date);
  }
}

export async function maybeAwardWeeklyBonus(patientId: number, date: string): Promise<void> {
  // Check if all three categories have at least one entry for this date
  const [waterRows, exerciseRows, mealRows] = await Promise.all([
    db.select({ id: waterEntriesTable.id }).from(waterEntriesTable)
      .where(and(eq(waterEntriesTable.patientId, patientId), eq(waterEntriesTable.date, date))).limit(1),
    db.select({ id: exerciseEntriesTable.id }).from(exerciseEntriesTable)
      .where(and(eq(exerciseEntriesTable.patientId, patientId), eq(exerciseEntriesTable.date, date))).limit(1),
    db.select({ id: calorieEntriesTable.id }).from(calorieEntriesTable)
      .where(and(eq(calorieEntriesTable.patientId, patientId), eq(calorieEntriesTable.date, date))).limit(1),
  ]);

  const isFullDay = waterRows.length > 0 && exerciseRows.length > 0 && mealRows.length > 0;
  if (!isFullDay) return;

  // Check if weekly_bonus already awarded for this date
  const existingBonus = await db
    .select({ id: xpEntriesTable.id })
    .from(xpEntriesTable)
    .where(
      and(
        eq(xpEntriesTable.patientId, patientId),
        eq(xpEntriesTable.date, date),
        eq(xpEntriesTable.reason, "weekly_bonus")
      )
    )
    .limit(1);

  if (existingBonus.length > 0) return;

  // Count full days in the current week (Sun-Sat)
  const checkInDate = new Date(date + "T12:00:00Z");
  const dayOfWeek = checkInDate.getUTCDay();
  const weekStart = new Date(checkInDate);
  weekStart.setUTCDate(checkInDate.getUTCDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const weekStartStr = weekStart.toISOString().split("T")[0]!;
  const weekEndStr = weekEnd.toISOString().split("T")[0]!;

  const [weekWater, weekExercise, weekMeal] = await Promise.all([
    db.select({ date: waterEntriesTable.date }).from(waterEntriesTable)
      .where(and(eq(waterEntriesTable.patientId, patientId), gte(waterEntriesTable.date, weekStartStr), lte(waterEntriesTable.date, weekEndStr))),
    db.select({ date: exerciseEntriesTable.date }).from(exerciseEntriesTable)
      .where(and(eq(exerciseEntriesTable.patientId, patientId), gte(exerciseEntriesTable.date, weekStartStr), lte(exerciseEntriesTable.date, weekEndStr))),
    db.select({ date: calorieEntriesTable.date }).from(calorieEntriesTable)
      .where(and(eq(calorieEntriesTable.patientId, patientId), gte(calorieEntriesTable.date, weekStartStr), lte(calorieEntriesTable.date, weekEndStr))),
  ]);

  const waterDates = new Set(weekWater.map((r) => r.date));
  const exerciseDates = new Set(weekExercise.map((r) => r.date));
  const mealDates = new Set(weekMeal.map((r) => r.date));

  let fullDays = 0;
  for (let d = new Date(weekStart); d.toISOString().split("T")[0]! <= weekEndStr; d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = d.toISOString().split("T")[0]!;
    if (waterDates.has(ds) && exerciseDates.has(ds) && mealDates.has(ds)) fullDays++;
  }

  if (fullDays >= 6) {
    await db.insert(xpEntriesTable).values({ patientId, points: WEEKLY_BONUS, reason: "weekly_bonus", date });
  }
}
