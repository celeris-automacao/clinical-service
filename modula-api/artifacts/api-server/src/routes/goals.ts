import { Router } from "express";
import { eq, and, desc, gt, or } from "drizzle-orm";
import {
  db,
  goalsTable,
  goalProgressTable,
  doctorsTable,
  usersTable,
  patientsTable,
} from "@workspace/db";
import {
  requireAuth,
  isError,
  ensurePatientAccess,
  resolveOwnerClinicId,
} from "../lib/auth-helpers";
import {
  CreateGoalBody,
  UpdateGoalBody,
  LogGoalProgressBody,
  ListGoalProgressQueryParams,
} from "@workspace/api-zod";
import { sendExpoPushNotifications } from "../lib/expoPush";

const router = Router();

type GoalRow = typeof goalsTable.$inferSelect;
type GoalProgressRow = typeof goalProgressTable.$inferSelect;

function toDateString(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().split("T")[0] : value;
}

function buildProgressResponse(progress: GoalProgressRow) {
  return {
    id: progress.id,
    goalId: progress.goalId,
    date: toDateString(progress.date),
    value: progress.value === null ? null : Number(progress.value),
    done: progress.done,
    note: progress.note,
    createdAt: progress.createdAt.toISOString(),
    updatedAt: progress.updatedAt.toISOString(),
  };
}

async function getLatestProgress(goalId: number) {
  const [row] = await db
    .select()
    .from(goalProgressTable)
    .where(eq(goalProgressTable.goalId, goalId))
    .orderBy(desc(goalProgressTable.date))
    .limit(1);
  return row ? buildProgressResponse(row) : null;
}

async function getDoctorName(doctorId: number): Promise<string> {
  const [row] = await db
    .select({ name: usersTable.name })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(eq(doctorsTable.id, doctorId))
    .limit(1);
  return row?.name ?? "";
}

async function resolveCanEdit(
  user: { id: number; role: string },
  goal: GoalRow,
  jwtClinicId?: number
): Promise<boolean> {
  if (user.role === "clinic_owner") {
    const ownerClinicId = await resolveOwnerClinicId(user.id, jwtClinicId);
    return ownerClinicId !== undefined && ownerClinicId === goal.clinicId;
  }
  if (user.role === "profissional_saude") {
    const [myDoctor] = await db
      .select({ id: doctorsTable.id })
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    return myDoctor !== undefined && myDoctor.id === goal.createdByDoctorId;
  }
  return false;
}

async function buildGoalResponse(
  goal: GoalRow,
  user: { id: number; role: string },
  jwtClinicId?: number
) {
  const [createdByName, canEdit, latestProgress] = await Promise.all([
    getDoctorName(goal.createdByDoctorId),
    resolveCanEdit(user, goal, jwtClinicId),
    getLatestProgress(goal.id),
  ]);
  return {
    id: goal.id,
    patientId: goal.patientId,
    createdByDoctorId: goal.createdByDoctorId,
    createdByName,
    clinicId: goal.clinicId,
    title: goal.title,
    description: goal.description,
    targetValue: goal.targetValue === null ? null : Number(goal.targetValue),
    unit: goal.unit,
    dueDate: toDateString(goal.dueDate),
    status: goal.status,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    canEdit,
    latestProgress,
  };
}

/** Fetch the patient's Expo push token (null if not registered). */
async function getPatientPushToken(patientId: number): Promise<string | null> {
  const [row] = await db
    .select({ pushToken: patientsTable.pushToken })
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);
  return row?.pushToken ?? null;
}

/** Fire-and-forget push notification to a patient — never throws. */
async function notifyPatientGoal(
  patientId: number,
  title: string,
  body: string
): Promise<void> {
  try {
    const pushToken = await getPatientPushToken(patientId);
    if (!pushToken) return;
    await sendExpoPushNotifications([
      { to: pushToken, title, body, data: { navigate: "/goals" } },
    ]);
  } catch {
    // best-effort — never let a push failure break the route
  }
}

router.get("/patients/:patientId/goals", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const patientId = Number(req.params.patientId);
  const allowed = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const statusFilter =
    typeof req.query.status === "string" ? req.query.status : undefined;

  const rows = await db
    .select()
    .from(goalsTable)
    .where(
      statusFilter
        ? and(
            eq(goalsTable.patientId, patientId),
            eq(goalsTable.status, statusFilter as GoalRow["status"])
          )
        : eq(goalsTable.patientId, patientId)
    )
    .orderBy(desc(goalsTable.createdAt));

  const response = await Promise.all(
    rows.map((row) => buildGoalResponse(row, user, authResult.clinicId))
  );
  res.json(response);
});

router.post("/patients/:patientId/goals", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role !== "profissional_saude") {
    res.status(403).json({ error: "Apenas profissionais de saúde podem criar metas" });
    return;
  }

  const patientId = Number(req.params.patientId);
  const allowed = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { title, description, targetValue, unit, dueDate } = parsed.data;

  const [myDoctor] = await db
    .select()
    .from(doctorsTable)
    .where(eq(doctorsTable.userId, user.id))
    .limit(1);
  if (!myDoctor) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const now = new Date();
  const [inserted] = await db
    .insert(goalsTable)
    .values({
      patientId,
      createdByDoctorId: myDoctor.id,
      clinicId: myDoctor.clinicId,
      title,
      description: description ?? null,
      targetValue: targetValue === null || targetValue === undefined ? null : String(targetValue),
      unit: unit ?? null,
      dueDate: dueDate ? dueDate.toISOString().split("T")[0] : null,
      lastStaffChangedAt: now,
    })
    .returning();

  // Notify the patient about their new goal (best-effort, non-blocking)
  void notifyPatientGoal(
    patientId,
    "Nova meta criada",
    `Seu profissional de saúde criou uma nova meta para você: ${title}`
  );

  res.status(201).json(await buildGoalResponse(inserted, user, authResult.clinicId));
});

router.patch("/goals/:goalId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const goalId = Number(req.params.goalId);
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.id, goalId)).limit(1);
  if (!goal) {
    res.status(404).json({ error: "Meta não encontrada" });
    return;
  }

  const allowed = await ensurePatientAccess(user, goal.patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const canEdit = await resolveCanEdit(user, goal, authResult.clinicId);
  if (!canEdit) {
    res.status(403).json({ error: "Apenas quem criou a meta ou o proprietário da clínica pode editá-la" });
    return;
  }

  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { title, description, targetValue, unit, dueDate, status } = parsed.data;

  // A "meaningful" change is one the patient should be notified about.
  // Description/unit edits are cosmetic and excluded.
  const hasMeaningfulChange =
    user.role !== "patient" &&
    (title !== undefined || targetValue !== undefined || dueDate !== undefined || status !== undefined);

  const patchNow = new Date();
  const [updated] = await db
    .update(goalsTable)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(targetValue !== undefined
        ? { targetValue: targetValue === null ? null : String(targetValue) }
        : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(dueDate !== undefined
        ? { dueDate: dueDate === null ? null : dueDate.toISOString().split("T")[0] }
        : {}),
      ...(status !== undefined ? { status } : {}),
      // Stamp lastStaffChangedAt only for meaningful staff edits so the
      // unread badge is not triggered by cosmetic description/unit changes.
      ...(hasMeaningfulChange ? { lastStaffChangedAt: patchNow } : {}),
      updatedAt: patchNow,
    })
    .where(eq(goalsTable.id, goalId))
    .returning();

  if (hasMeaningfulChange) {
    const effectiveTitle = title ?? goal.title;
    let bodyText = `Sua meta foi atualizada: ${effectiveTitle}`;
    if (status !== undefined && status !== goal.status) {
      const statusLabel: Record<string, string> = {
        completed: "concluída",
        archived: "arquivada",
        active: "reativada",
      };
      bodyText = `Meta ${statusLabel[status] ?? "atualizada"}: ${effectiveTitle}`;
    }
    void notifyPatientGoal(goal.patientId, "Meta atualizada", bodyText);
  }

  res.json(await buildGoalResponse(updated, user, authResult.clinicId));
});

router.delete("/goals/:goalId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const goalId = Number(req.params.goalId);
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.id, goalId)).limit(1);
  if (!goal) {
    res.status(404).json({ error: "Meta não encontrada" });
    return;
  }

  const allowed = await ensurePatientAccess(user, goal.patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const canEdit = await resolveCanEdit(user, goal, authResult.clinicId);
  if (!canEdit) {
    res.status(403).json({ error: "Apenas quem criou a meta ou o proprietário da clínica pode excluí-la" });
    return;
  }

  await db.delete(goalsTable).where(eq(goalsTable.id, goalId));
  res.status(204).send();
});

router.get("/goals/:goalId/progress", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const goalId = Number(req.params.goalId);
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.id, goalId)).limit(1);
  if (!goal) {
    res.status(404).json({ error: "Meta não encontrada" });
    return;
  }

  const allowed = await ensurePatientAccess(user, goal.patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const queryParsed = ListGoalProgressQueryParams.safeParse(req.query);
  const limit = queryParsed.success ? queryParsed.data.limit : 60;

  const rows = await db
    .select()
    .from(goalProgressTable)
    .where(eq(goalProgressTable.goalId, goalId))
    .orderBy(desc(goalProgressTable.date))
    .limit(limit);

  res.json(rows.map(buildProgressResponse));
});

router.post("/goals/:goalId/progress", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role !== "patient") {
    res.status(403).json({ error: "Apenas o paciente pode registrar seu progresso" });
    return;
  }

  const goalId = Number(req.params.goalId);
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.id, goalId)).limit(1);
  if (!goal) {
    res.status(404).json({ error: "Meta não encontrada" });
    return;
  }

  const allowed = await ensurePatientAccess(user, goal.patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const parsed = LogGoalProgressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { date, value, done, note } = parsed.data;
  const dateStr = date ? date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

  const [existing] = await db
    .select()
    .from(goalProgressTable)
    .where(and(eq(goalProgressTable.goalId, goalId), eq(goalProgressTable.date, dateStr)))
    .limit(1);

  const [saved] = existing
    ? await db
        .update(goalProgressTable)
        .set({
          value: value === null || value === undefined ? null : String(value),
          done,
          note: note ?? null,
          updatedAt: new Date(),
        })
        .where(eq(goalProgressTable.id, existing.id))
        .returning()
    : await db
        .insert(goalProgressTable)
        .values({
          goalId,
          date: dateStr,
          value: value === null || value === undefined ? null : String(value),
          done,
          note: note ?? null,
        })
        .returning();

  res.json(buildProgressResponse(saved));
});

// ── Unread goal count / mark-seen (patient-facing) ────────────────────────

/**
 * GET /patients/me/goals/unread-count
 * Returns how many goals have a lastStaffChangedAt newer than the patient's
 * lastSeenGoalsAt. Covers all statuses (active/completed/archived) so a
 * professional marking a goal as "completed" is also surfaced. Returns 0 for
 * non-patient callers.
 */
router.get("/patients/me/goals/unread-count", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role !== "patient") {
    res.json({ count: 0 });
    return;
  }

  // Resolve patient row to get patientId + lastSeenGoalsAt
  const [patientRow] = await db
    .select({ id: patientsTable.id, lastSeenGoalsAt: patientsTable.lastSeenGoalsAt })
    .from(patientsTable)
    .where(eq(patientsTable.userId, user.id))
    .limit(1);

  if (!patientRow) {
    res.json({ count: 0 });
    return;
  }

  const { lastSeenGoalsAt } = patientRow;

  // Count goals that have a staff-change timestamp (lastStaffChangedAt is set
  // only by the POST/PATCH handlers on meaningful edits) that is newer than
  // the patient's last visit. If the patient has never opened the goals screen
  // (lastSeenGoalsAt is null), count every goal that has any staff timestamp.
  const rows = await db
    .select({ id: goalsTable.id })
    .from(goalsTable)
    .where(
      lastSeenGoalsAt
        ? and(
            eq(goalsTable.patientId, patientRow.id),
            gt(goalsTable.lastStaffChangedAt, lastSeenGoalsAt)
          )
        : eq(goalsTable.patientId, patientRow.id)
    );

  res.json({ count: rows.length });
});

/**
 * POST /patients/me/goals/mark-seen
 * Stamps lastSeenGoalsAt = now(), resetting the unread badge to zero.
 * No-op for non-patient callers.
 */
router.post("/patients/me/goals/mark-seen", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role !== "patient") {
    res.status(204).send();
    return;
  }

  await db
    .update(patientsTable)
    .set({ lastSeenGoalsAt: new Date() })
    .where(eq(patientsTable.userId, user.id));

  res.status(204).send();
});

export default router;
