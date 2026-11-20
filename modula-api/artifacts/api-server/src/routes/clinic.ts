import { Router } from "express";
import { eq, sql, desc, inArray, and, ne } from "drizzle-orm";
import { db, patientsTable, doctorsTable, patientDoctorsTable, usersTable, checkInsTable, weightEntriesTable, xpEntriesTable, sabotageNotesTable, staffEventsTable, patientClinicsTable } from "@workspace/db";
import { requireAuth, isError, resolveCallerClinicId } from "../lib/auth-helpers";

const router = Router();

/**
 * Resolve the list of patient IDs visible to the current user within their clinic.
 * - clinic_owner: all patients enrolled in their clinic
 * - profissional_saude: patients assigned to them
 * Returns null when no restriction applies (shouldn't happen in scoped routes).
 */
async function resolveVisiblePatientIds(
  user: { id: number; role: string },
  clinicId: number
): Promise<number[]> {
  if (user.role === "clinic_owner" || user.role === "secretaria") {
    const rows = await db
      .select({ patientId: patientClinicsTable.patientId })
      .from(patientClinicsTable)
      .where(eq(patientClinicsTable.clinicId, clinicId));
    return rows.map((r) => r.patientId);
  }
  if (user.role === "profissional_saude") {
    const [doc] = await db
      .select({ id: doctorsTable.id })
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    if (!doc) return [];
    const rows = await db
      .select({ patientId: patientDoctorsTable.patientId })
      .from(patientDoctorsTable)
      .where(eq(patientDoctorsTable.doctorId, doc.id));
    return rows.map((r) => r.patientId);
  }
  return [];
}

router.get("/clinic/dashboard", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role === "patient") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { user } = authResult;

  // Resolve effective clinic — owners and staff both scope to a clinic
  const effectiveClinicId = await resolveCallerClinicId(user, authResult.clinicId);

  if (!effectiveClinicId) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const visiblePatientIds = await resolveVisiblePatientIds(user, effectiveClinicId);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weekStr = startOfWeek.toISOString().split("T")[0];

  const patientFilter = visiblePatientIds.length > 0
    ? inArray(patientsTable.id, visiblePatientIds)
    : sql`false`;
  const patientCheckInFilter = visiblePatientIds.length > 0
    ? and(inArray(checkInsTable.patientId, visiblePatientIds), sql`${checkInsTable.date} >= ${weekStr}`)
    : sql`false`;
  const patientXpFilter = visiblePatientIds.length > 0
    ? inArray(xpEntriesTable.patientId, visiblePatientIds)
    : sql`false`;
  const doctorClinicFilter = eq(doctorsTable.clinicId, effectiveClinicId);

  const [
    totalPatientsResult,
    totalDoctorsResult,
    totalXpResult,
    activeThisWeekResult,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(patientsTable).where(patientFilter),
    db.select({ count: sql<number>`count(*)` }).from(doctorsTable).where(doctorClinicFilter),
    db.select({ total: sql<number>`coalesce(sum(${xpEntriesTable.points}), 0)` }).from(xpEntriesTable).where(patientXpFilter),
    db
      .select({ count: sql<number>`count(distinct ${checkInsTable.patientId})` })
      .from(checkInsTable)
      .where(patientCheckInFilter),
  ]);

  const totalPatients = Number(totalPatientsResult[0]?.count ?? 0);
  const totalDoctors = Number(totalDoctorsResult[0]?.count ?? 0);
  const totalXpAwarded = Number(totalXpResult[0]?.total ?? 0);
  const activeThisWeek = Number(activeThisWeekResult[0]?.count ?? 0);

  // Average weight loss (scoped to visible patients)
  const allPatients = visiblePatientIds.length > 0
    ? await db.select().from(patientsTable).where(inArray(patientsTable.id, visiblePatientIds))
    : [];
  let totalLoss = 0;
  let countWithData = 0;

  for (const p of allPatients) {
    const latest = await db
      .select()
      .from(weightEntriesTable)
      .where(eq(weightEntriesTable.patientId, p.id))
      .orderBy(desc(weightEntriesTable.date))
      .limit(1);

    if (latest.length > 0) {
      const loss = Number(p.startWeight) - Number(latest[0].weightKg);
      if (loss > 0) {
        totalLoss += loss;
        countWithData++;
      }
    }
  }

  const avgWeightLoss = countWithData > 0 ? Math.round((totalLoss / countWithData) * 10) / 10 : 0;

  // Top patients by XP (scoped to visible patients)
  const xpByPatient = visiblePatientIds.length > 0
    ? await db
        .select({
          patientId: xpEntriesTable.patientId,
          total: sql<number>`coalesce(sum(${xpEntriesTable.points}), 0)`,
        })
        .from(xpEntriesTable)
        .where(inArray(xpEntriesTable.patientId, visiblePatientIds))
        .groupBy(xpEntriesTable.patientId)
        .orderBy(desc(sql`sum(${xpEntriesTable.points})`))
        .limit(5)
    : [];

  const topPatients = await Promise.all(
    xpByPatient.map(async ({ patientId, total }) => {
      const p = await db
        .select({ patient: patientsTable, user: usersTable })
        .from(patientsTable)
        .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
        .where(eq(patientsTable.id, patientId))
        .limit(1);

      if (p.length === 0) return null;

      const latest = await db
        .select()
        .from(weightEntriesTable)
        .where(eq(weightEntriesTable.patientId, patientId))
        .orderBy(desc(weightEntriesTable.date))
        .limit(1);

      const weightLostKg = latest.length > 0
        ? Math.max(0, Number(p[0].patient.startWeight) - Number(latest[0].weightKg))
        : 0;

      return {
        patientId,
        name: p[0].user.name,
        avatarUrl: p[0].user.avatarUrl ?? null,
        totalXp: Number(total),
        weightLostKg: Math.round(weightLostKg * 10) / 10,
      };
    })
  );

  // Weight loss by month (last 6 months)
  const weightLossByMonth: Array<{ month: string; avgWeightKg: number; patientCount: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const baseWeightWhere = sql`${weightEntriesTable.date} >= ${d.toISOString().split("T")[0]} AND ${weightEntriesTable.date} < ${nextMonth.toISOString().split("T")[0]}`;
    const weights = visiblePatientIds.length > 0
      ? await db
          .select({ weightKg: weightEntriesTable.weightKg, patientId: weightEntriesTable.patientId })
          .from(weightEntriesTable)
          .where(and(baseWeightWhere, inArray(weightEntriesTable.patientId, visiblePatientIds)))
      : [];

    const avg = weights.length > 0
      ? weights.reduce((sum, w) => sum + Number(w.weightKg), 0) / weights.length
      : 0;

    const uniquePatients = new Set(weights.map((w) => w.patientId)).size;

    weightLossByMonth.push({
      month: monthStr,
      avgWeightKg: Math.round(avg * 10) / 10,
      patientCount: uniquePatients,
    });
  }

  // Doctor workload: patient count per doctor (scoped to this clinic's doctors)
  const doctorWorkloadRaw = await db
    .select({
      doctorId: doctorsTable.id,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
      patientCount: sql<number>`count(${patientDoctorsTable.patientId})`,
    })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .leftJoin(patientDoctorsTable, eq(patientDoctorsTable.doctorId, doctorsTable.id))
    .where(doctorClinicFilter)
    .groupBy(doctorsTable.id, usersTable.name, usersTable.avatarUrl)
    .orderBy(desc(sql`count(${patientDoctorsTable.patientId})`));

  const doctorWorkload = doctorWorkloadRaw.map((row) => ({
    doctorId: row.doctorId,
    name: row.name,
    avatarUrl: row.avatarUrl ?? null,
    patientCount: Number(row.patientCount),
  }));

  res.json({
    totalPatients,
    totalDoctors,
    avgWeightLoss,
    activeThisWeek,
    totalXpAwarded,
    topPatients: topPatients.filter(Boolean),
    weightLossByMonth,
    doctorWorkload,
  });
});

router.get("/clinic/activity-feed", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role === "patient") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { user } = authResult;

  // Resolve effective clinic for scoping
  const feedClinicId = await resolveCallerClinicId(user, authResult.clinicId);

  if (!feedClinicId) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const feedVisibleIds = await resolveVisiblePatientIds(user, feedClinicId);
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  if (feedVisibleIds.length === 0) {
    res.json([]);
    return;
  }

  const patientFilter = inArray(patientsTable.id, feedVisibleIds);

  const [checkIns, weights, sabotages, staffEvents] = await Promise.all([
    db
      .select({ ci: checkInsTable, user: usersTable, patient: patientsTable })
      .from(checkInsTable)
      .innerJoin(patientsTable, and(eq(patientsTable.id, checkInsTable.patientId), patientFilter))
      .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
      .orderBy(desc(checkInsTable.createdAt))
      .limit(limit),
    db
      .select({ we: weightEntriesTable, user: usersTable, patient: patientsTable })
      .from(weightEntriesTable)
      .innerJoin(patientsTable, and(eq(patientsTable.id, weightEntriesTable.patientId), patientFilter))
      .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
      .orderBy(desc(weightEntriesTable.createdAt))
      .limit(limit),
    db
      .select({ sn: sabotageNotesTable, user: usersTable, patient: patientsTable })
      .from(sabotageNotesTable)
      .innerJoin(patientsTable, and(eq(patientsTable.id, sabotageNotesTable.patientId), patientFilter))
      .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
      .orderBy(desc(sabotageNotesTable.createdAt))
      .limit(limit),
    db
      .select({ se: staffEventsTable, user: usersTable })
      .from(staffEventsTable)
      .innerJoin(usersTable, eq(usersTable.id, staffEventsTable.userId))
      .where(and(eq(staffEventsTable.clinicId, feedClinicId), ne(staffEventsTable.type, "audit_write_failure")))
      .orderBy(desc(staffEventsTable.createdAt))
      .limit(limit),
  ]);

  type ActivityItem = {
    id: number;
    type: string;
    patientId: number;
    patientName: string;
    avatarUrl: string | null;
    description: string;
    createdAt: string;
  };

  const items: ActivityItem[] = [
    ...checkIns.map(({ ci, user: u, patient: p }) => ({
      id: ci.id,
      type: "check_in" as const,
      patientId: p.id,
      patientName: u.name,
      avatarUrl: u.avatarUrl ?? null,
      description: `Check-in: ${[ci.didExercise && "exercício", ci.drankWater && "água", ci.ateWell && "alimentação"].filter(Boolean).join(", ")}`,
      createdAt: ci.createdAt.toISOString(),
    })),
    ...weights.map(({ we, user: u, patient: p }) => ({
      id: we.id,
      type: "weight_entry" as const,
      patientId: p.id,
      patientName: u.name,
      avatarUrl: u.avatarUrl ?? null,
      description: `Registrou peso: ${Number(we.weightKg).toFixed(1)} kg`,
      createdAt: we.createdAt.toISOString(),
    })),
    ...sabotages.map(({ sn, user: u, patient: p }) => ({
      id: sn.id,
      type: "sabotage_note" as const,
      patientId: p.id,
      patientName: u.name,
      avatarUrl: u.avatarUrl ?? null,
      description: `Nota de sabotagem: ${sn.reason.slice(0, 60)}${sn.reason.length > 60 ? "..." : ""}`,
      createdAt: sn.createdAt.toISOString(),
    })),
    ...staffEvents.filter(({ se }) => se.type !== "audit_write_failure").map(({ se, user: u }) => ({
      id: se.id,
      type: (se.type === "appointment_booked" ||
        se.type === "appointment_cancelled" ||
        se.type === "appointment_updated" ||
        se.type === "patient_note" ||
        se.type === "lead_created" ||
        se.type === "lead_stage_changed" ||
        se.type === "plan_limit_warning" ||
        se.type === "plan_limit_reached" ||
        se.type === "form_response_submitted" ||
        se.type === "access_code_auto_resent"
        ? se.type
        : "staff_onboarding") as
        | "staff_onboarding"
        | "appointment_booked"
        | "appointment_cancelled"
        | "appointment_updated"
        | "patient_note"
        | "lead_created"
        | "lead_stage_changed"
        | "plan_limit_warning"
        | "plan_limit_reached"
        | "form_response_submitted"
        | "access_code_auto_resent",
      patientId: u.id,
      patientName: u.name,
      avatarUrl: u.avatarUrl ?? null,
      description: se.description,
      createdAt: se.createdAt.toISOString(),
    })),
  ];

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(items.slice(0, limit));
});

export default router;
