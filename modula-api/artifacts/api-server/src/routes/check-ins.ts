import { Router } from "express";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import {
  db,
  checkInsTable,
  patientsTable,
  xpEntriesTable,
  doctorsTable,
  patientDoctorsTable,
  patientClinicsTable,
  waterEntriesTable,
  exerciseEntriesTable,
  calorieEntriesTable,
} from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess, resolveOwnerClinicId } from "../lib/auth-helpers";
import { CreateCheckInBody, UpdateCheckInBody } from "@workspace/api-zod";

const router = Router();

const WEEKLY_BONUS = 50;

async function getOwnPatientId(userId: number): Promise<number | null> {
  const rows = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function getAssignedPatientIds(doctorUserId: number): Promise<number[]> {
  const doctorRows = await db
    .select()
    .from(doctorsTable)
    .where(eq(doctorsTable.userId, doctorUserId))
    .limit(1);
  if (doctorRows.length === 0) return [];
  const doctorId = doctorRows[0].id;

  const links = await db
    .select()
    .from(patientDoctorsTable)
    .where(eq(patientDoctorsTable.doctorId, doctorId));

  const userIds = links.map((l) => l.patientId);
  if (userIds.length === 0) return [];

  const patients = await db
    .select()
    .from(patientsTable)
    .where(inArray(patientsTable.userId, userIds));

  return patients.map((p) => p.id);
}

async function awardXpFromNewTables(patientId: number, date: string): Promise<number> {
  const [waterRows, exerciseRows, mealRows] = await Promise.all([
    db.select({ id: waterEntriesTable.id }).from(waterEntriesTable)
      .where(and(eq(waterEntriesTable.patientId, patientId), eq(waterEntriesTable.date, date))).limit(1),
    db.select({ id: exerciseEntriesTable.id }).from(exerciseEntriesTable)
      .where(and(eq(exerciseEntriesTable.patientId, patientId), eq(exerciseEntriesTable.date, date))).limit(1),
    db.select({ id: calorieEntriesTable.id }).from(calorieEntriesTable)
      .where(and(eq(calorieEntriesTable.patientId, patientId), eq(calorieEntriesTable.date, date))).limit(1),
  ]);

  const hasWater = waterRows.length > 0;
  const hasExercise = exerciseRows.length > 0;
  const hasMeal = mealRows.length > 0;

  const existingXp = await db
    .select({ reason: xpEntriesTable.reason })
    .from(xpEntriesTable)
    .where(and(eq(xpEntriesTable.patientId, patientId), eq(xpEntriesTable.date, date)));

  const existingReasons = new Set(existingXp.map((x) => x.reason));
  const toInsert: Array<{ patientId: number; points: number; reason: typeof xpEntriesTable.$inferInsert["reason"]; date: string }> = [];

  if (hasWater && !existingReasons.has("water")) {
    toInsert.push({ patientId, points: 50, reason: "water", date });
  }
  if (hasExercise && !existingReasons.has("exercise")) {
    toInsert.push({ patientId, points: 50, reason: "exercise", date });
  }
  if (hasMeal && !existingReasons.has("nutrition")) {
    toInsert.push({ patientId, points: 50, reason: "nutrition", date });
  }

  if (toInsert.length > 0) {
    await db.insert(xpEntriesTable).values(toInsert);
  }

  // Check weekly bonus: if this day completes a full week (≥6 full days in the week)
  if (hasWater && hasExercise && hasMeal && !existingReasons.has("weekly_bonus")) {
    const checkInDate = new Date(date);
    const dayOfWeek = checkInDate.getDay();
    const weekStart = new Date(checkInDate);
    weekStart.setDate(checkInDate.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
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
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0]!;
      if (waterDates.has(ds) && exerciseDates.has(ds) && mealDates.has(ds)) fullDays++;
    }

    if (fullDays >= 6) {
      await db.insert(xpEntriesTable).values({ patientId, points: WEEKLY_BONUS, reason: "weekly_bonus", date });
    }
  }

  const total = await db
    .select({ sum: xpEntriesTable.points })
    .from(xpEntriesTable)
    .where(and(eq(xpEntriesTable.patientId, patientId), eq(xpEntriesTable.date, date)));

  return total.reduce((acc, r) => acc + r.sum, 0);
}

router.get("/check-ins", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  // When both startDate and endDate are provided (bounded range), omit the
  // default limit so callers like the photo strip get ALL check-ins in the
  // period.  An explicit ?limit=N still overrides this behaviour.
  const limit: number | undefined = req.query.limit
    ? Number(req.query.limit)
    : startDate && endDate
      ? undefined
      : 30;

  let effectivePatientId: number | undefined;

  if (user.role === "patient") {
    const ownId = await getOwnPatientId(user.id);
    if (!ownId) {
      res.status(404).json({ error: "Patient record not found" });
      return;
    }
    effectivePatientId = ownId;
  } else if (user.role === "profissional_saude") {
    const requestedId = req.query.patientId ? Number(req.query.patientId) : undefined;
    if (requestedId) {
      const allowed = await ensurePatientAccess(user, requestedId, authResult.clinicId);
      if (!allowed) {
        res.status(403).json({ error: "Not authorized to view this patient" });
        return;
      }
      effectivePatientId = requestedId;
    } else {
      const assignedIds = await getAssignedPatientIds(user.id);
      if (assignedIds.length === 0) {
        res.json([]);
        return;
      }
      const baseQ = db
        .select()
        .from(checkInsTable)
        .where(
          and(
            inArray(checkInsTable.patientId, assignedIds),
            startDate ? gte(checkInsTable.date, startDate) : undefined,
            endDate ? lte(checkInsTable.date, endDate) : undefined
          )
        )
        .orderBy(desc(checkInsTable.date));
      const rows = await (limit !== undefined ? baseQ.limit(limit) : baseQ);
      res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), xpEarned: r.xpEarned ?? 0 })));
      return;
    }
  } else {
    // clinic_owner: scope to their clinic's patients
    const ownerClinicId = await resolveOwnerClinicId(user.id, authResult.clinicId);
    if (!ownerClinicId) {
      res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
      return;
    }
    const requestedId = req.query.patientId ? Number(req.query.patientId) : undefined;
    if (requestedId) {
      const allowed = await ensurePatientAccess(user, requestedId, authResult.clinicId);
      if (!allowed) {
        res.status(403).json({ error: "Not authorized to view this patient" });
        return;
      }
      effectivePatientId = requestedId;
    } else {
      const clinicPatients = await db
        .select({ patientId: patientClinicsTable.patientId })
        .from(patientClinicsTable)
        .where(eq(patientClinicsTable.clinicId, ownerClinicId));
      const clinicPatientIds = clinicPatients.map((r) => r.patientId);
      if (clinicPatientIds.length === 0) {
        res.json([]);
        return;
      }
      const baseQ = db
        .select()
        .from(checkInsTable)
        .where(
          and(
            inArray(checkInsTable.patientId, clinicPatientIds),
            startDate ? gte(checkInsTable.date, startDate) : undefined,
            endDate ? lte(checkInsTable.date, endDate) : undefined
          )
        )
        .orderBy(desc(checkInsTable.date));
      const rows = await (limit !== undefined ? baseQ.limit(limit) : baseQ);
      res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), xpEarned: r.xpEarned ?? 0 })));
      return;
    }
  }

  const conditions = [];
  if (effectivePatientId) conditions.push(eq(checkInsTable.patientId, effectivePatientId));
  if (startDate) conditions.push(gte(checkInsTable.date, startDate));
  if (endDate) conditions.push(lte(checkInsTable.date, endDate));

  const baseQ = db
    .select()
    .from(checkInsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(checkInsTable.date));
  const rows = await (limit !== undefined ? baseQ.limit(limit) : baseQ);

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), xpEarned: r.xpEarned ?? 0 })));
});

router.post("/check-ins", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = CreateCheckInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { user } = authResult;

  if (user.role !== "patient") {
    res.status(403).json({ error: "Only patients can submit check-ins" });
    return;
  }

  const patientRows = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.userId, user.id))
    .limit(1);
  if (patientRows.length === 0) {
    res.status(404).json({ error: "Patient record not found" });
    return;
  }
  const patientId = patientRows[0].id;

  const { date, note, photoUrl } = parsed.data as any;
  const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : String(date);

  const inserted = await db
    .insert(checkInsTable)
    .values({
      patientId,
      date: dateStr,
      note: note ?? null,
      photoUrl: photoUrl ?? null,
      xpEarned: 0,
    })
    .returning();

  const xpEarned = await awardXpFromNewTables(patientId, dateStr);
  await db.update(checkInsTable).set({ xpEarned }).where(eq(checkInsTable.id, inserted[0].id));

  res.status(201).json({
    ...inserted[0],
    xpEarned,
    createdAt: inserted[0].createdAt.toISOString(),
  });
});

router.get("/check-ins/:checkInId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.checkInId) ? req.params.checkInId[0] : req.params.checkInId;
  const id = parseInt(raw, 10);

  const rows = await db.select().from(checkInsTable).where(eq(checkInsTable.id, id)).limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }

  const patient = await ensurePatientAccess(authResult.user, rows[0].patientId, authResult.clinicId);
  if (!patient) {
    res.status(403).json({ error: "Not authorized to view this check-in" });
    return;
  }

  res.json({ ...rows[0], createdAt: rows[0].createdAt.toISOString() });
});

router.patch("/check-ins/:checkInId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = UpdateCheckInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const raw = Array.isArray(req.params.checkInId) ? req.params.checkInId[0] : req.params.checkInId;
  const id = parseInt(raw, 10);

  const existing = await db.select().from(checkInsTable).where(eq(checkInsTable.id, id)).limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }

  const patient = await ensurePatientAccess(authResult.user, existing[0].patientId, authResult.clinicId);
  if (!patient) {
    res.status(403).json({ error: "Not authorized to update this check-in" });
    return;
  }

  const { note, photoUrl } = parsed.data as any;
  const updateData: Record<string, unknown> = {};
  if (note !== undefined) updateData.note = note;
  if (photoUrl !== undefined) updateData.photoUrl = photoUrl;

  if (Object.keys(updateData).length > 0) {
    await db.update(checkInsTable).set(updateData).where(eq(checkInsTable.id, id));
  }

  const updated = await db.select().from(checkInsTable).where(eq(checkInsTable.id, id)).limit(1);
  res.json({ ...updated[0], createdAt: updated[0].createdAt.toISOString() });
});

export default router;
