import { Router } from "express";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  patientsTable,
  checkInsTable,
  weightEntriesTable,
  goalsTable,
  goalProgressTable,
  sabotageNotesTable,
  messagesTable,
  conversationsTable,
  consentRecordsTable,
  dataDeletionRequestsTable,
  dataAccessLogTable,
  staffEventsTable,
  waterEntriesTable,
  exerciseEntriesTable,
  patientClinicsTable,
  clinicOwnersTable,
  clinicsTable,
  auditFailuresTable,
} from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId } from "../lib/auth-helpers";
import { sendDeletionRequestNotificationEmail } from "../lib/email";
import { z } from "zod/v4";

const router = Router();

// ── POST /patients/me/consent ── (patient grants LGPD consent)
router.post("/patients/me/consent", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem registrar consentimento." });
    return;
  }

  const parsed = z
    .object({
      clinicId: z.number().int().positive().optional(),
      purpose: z.string().optional(),
      version: z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const { clinicId, purpose = "health_data_processing", version = "1.0" } = parsed.data;
  const ip = req.ip ?? req.socket?.remoteAddress ?? null;
  const userId = authResult.user.id;

  // Revoke any existing active consent for this purpose/clinic before inserting new one
  await db
    .update(consentRecordsTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(consentRecordsTable.userId, userId),
        eq(consentRecordsTable.purpose, purpose),
        isNull(consentRecordsTable.revokedAt),
        clinicId ? eq(consentRecordsTable.clinicId, clinicId) : isNull(consentRecordsTable.clinicId)
      )
    );

  const [record] = await db
    .insert(consentRecordsTable)
    .values({
      userId,
      clinicId: clinicId ?? null,
      purpose,
      version,
      ipAddress: ip,
    })
    .returning();

  res.status(201).json({
    id: record.id,
    purpose: record.purpose,
    version: record.version,
    grantedAt: record.grantedAt.toISOString(),
  });
});

// ── DELETE /patients/me/consent ── (patient revokes LGPD consent)
router.delete("/patients/me/consent", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem revogar consentimento." });
    return;
  }

  const parsed = z
    .object({ clinicId: z.number().int().positive().optional(), purpose: z.string().optional() })
    .safeParse(req.body);

  const { clinicId, purpose = "health_data_processing" } = parsed.success ? parsed.data : { clinicId: undefined, purpose: "health_data_processing" };

  await db
    .update(consentRecordsTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(consentRecordsTable.userId, authResult.user.id),
        eq(consentRecordsTable.purpose, purpose),
        isNull(consentRecordsTable.revokedAt),
        clinicId ? eq(consentRecordsTable.clinicId, clinicId) : isNull(consentRecordsTable.clinicId)
      )
    );

  res.json({ success: true });
});

// ── GET /patients/me/consent ── (check current consent status)
router.get("/patients/me/consent", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem verificar consentimento." });
    return;
  }

  const clinicId = authResult.clinicId;

  const { or: orOp } = await import("drizzle-orm");

  const records = await db
    .select()
    .from(consentRecordsTable)
    .where(
      and(
        eq(consentRecordsTable.userId, authResult.user.id),
        isNull(consentRecordsTable.revokedAt),
        clinicId
          ? orOp(eq(consentRecordsTable.clinicId, clinicId), isNull(consentRecordsTable.clinicId))
          : undefined
      )
    )
    .orderBy(desc(consentRecordsTable.grantedAt))
    .limit(1);

  const active = records[0] ?? null;

  res.json({
    hasConsent: !!active,
    grantedAt: active?.grantedAt.toISOString() ?? null,
    version: active?.version ?? null,
    purpose: active?.purpose ?? null,
  });
});

// ── GET /patients/me/export ── (data portability — Art. 18 LGPD)
router.get("/patients/me/export", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem exportar seus dados." });
    return;
  }

  const userId = authResult.user.id;
  const user = authResult.user;

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.userId, userId))
    .limit(1);

  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado." });
    return;
  }

  const [checkIns, weights, sabotageNotes, goals, waterEntries, exerciseEntries] = await Promise.all([
    db.select().from(checkInsTable).where(eq(checkInsTable.patientId, patient.id)).orderBy(desc(checkInsTable.date)),
    db.select().from(weightEntriesTable).where(eq(weightEntriesTable.patientId, patient.id)).orderBy(desc(weightEntriesTable.date)),
    db.select().from(sabotageNotesTable).where(eq(sabotageNotesTable.patientId, patient.id)).orderBy(desc(sabotageNotesTable.createdAt)),
    db.select().from(goalsTable).where(eq(goalsTable.patientId, patient.id)),
    db.select().from(waterEntriesTable).where(eq(waterEntriesTable.patientId, patient.id)).orderBy(desc(waterEntriesTable.date)),
    db.select().from(exerciseEntriesTable).where(eq(exerciseEntriesTable.patientId, patient.id)).orderBy(desc(exerciseEntriesTable.date)),
  ]);

  // Fetch goal progress for this patient's goals
  const goalIds = goals.map((g) => g.id);
  const { inArray: inArrayGP } = await import("drizzle-orm");
  const goalProgress = goalIds.length
    ? await db.select().from(goalProgressTable).where(inArrayGP(goalProgressTable.goalId, goalIds))
    : [];

  // Fetch messages from conversations where this patient's userId is a participant
  const { or } = await import("drizzle-orm");
  const patientConversations = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(
      or(
        eq(conversationsTable.participantAUserId, userId),
        eq(conversationsTable.participantBUserId, userId)
      )
    );

  const conversationIds = patientConversations.map((c) => c.id);
  const { inArray: inArrayMs } = await import("drizzle-orm");
  const messages = conversationIds.length
    ? await db
        .select()
        .from(messagesTable)
        .where(inArrayMs(messagesTable.conversationId, conversationIds))
        .orderBy(desc(messagesTable.createdAt))
        .limit(500)
    : [];

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    patientData: {
      id: patient.id,
      dateOfBirth: patient.dateOfBirth,
      phone: patient.phone,
      cpf: patient.cpf,
      rg: patient.rg,
      addressStreet: patient.addressStreet,
      addressNumber: patient.addressNumber,
      addressComplement: patient.addressComplement,
      addressNeighborhood: patient.addressNeighborhood,
      addressCity: patient.addressCity,
      addressState: patient.addressState,
      addressZip: patient.addressZip,
      startWeight: patient.startWeight,
      targetWeight: patient.targetWeight,
      dailyCalorieGoal: patient.dailyCalorieGoal,
      allergies: patient.allergies,
      dietaryRestrictions: patient.dietaryRestrictions,
      createdAt: patient.createdAt.toISOString(),
    },
    checkIns: checkIns.map((c) => ({
      id: c.id,
      date: c.date,
      didExercise: c.didExercise,
      drankWater: c.drankWater,
      ateWell: c.ateWell,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
    })),
    weightEntries: weights.map((w) => ({
      id: w.id,
      date: w.date,
      weightKg: w.weightKg,
      createdAt: w.createdAt.toISOString(),
    })),
    waterEntries: waterEntries.map((w) => ({
      id: w.id,
      date: w.date,
      amountMl: w.amountMl,
      createdAt: w.createdAt.toISOString(),
    })),
    exerciseEntries: exerciseEntries.map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      durationMin: e.durationMin,
      calorieEstimate: e.calorieEstimate,
      createdAt: e.createdAt.toISOString(),
    })),
    sabotageNotes: sabotageNotes.map((n) => ({
      id: n.id,
      reason: n.reason,
      whatHappened: n.whatHappened,
      createdAt: n.createdAt.toISOString(),
    })),
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      createdAt: g.createdAt.toISOString(),
    })),
    goalProgress: goalProgress.map((p) => ({
      id: p.id,
      goalId: p.goalId,
      date: p.date,
      done: p.done,
      note: p.note,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="meus-dados.json"');
  res.json(exportData);
});

// ── POST /patients/me/delete-request ── (patient requests data deletion — Art. 18 LGPD)
router.post("/patients/me/delete-request", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem solicitar exclusão de dados." });
    return;
  }

  const userId = authResult.user.id;

  // Check for existing pending request
  const [existing] = await db
    .select()
    .from(dataDeletionRequestsTable)
    .where(
      and(
        eq(dataDeletionRequestsTable.userId, userId),
        isNull(dataDeletionRequestsTable.approvedAt),
        isNull(dataDeletionRequestsTable.cancelledAt)
      )
    )
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Já existe uma solicitação de exclusão pendente." });
    return;
  }

  // Check for a recently cancelled request (24 h cooldown to prevent email flooding)
  const cooldownMs = 24 * 60 * 60 * 1000;
  const cooldownCutoff = new Date(Date.now() - cooldownMs);

  const [recentlyCancelled] = await db
    .select()
    .from(dataDeletionRequestsTable)
    .where(
      and(
        eq(dataDeletionRequestsTable.userId, userId),
        isNotNull(dataDeletionRequestsTable.cancelledAt)
      )
    )
    .orderBy(desc(dataDeletionRequestsTable.cancelledAt))
    .limit(1);

  if (recentlyCancelled?.cancelledAt && recentlyCancelled.cancelledAt > cooldownCutoff) {
    const retryAfter = new Date(recentlyCancelled.cancelledAt.getTime() + cooldownMs);
    const retryAfterStr = retryAfter.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    res.status(429).json({
      error: `Uma solicitação cancelada recentemente impede novo envio por 24 horas. Tente novamente após ${retryAfterStr}.`,
    });
    return;
  }

  // Detect whether this is a re-submission (any prior cancelled request exists)
  const isResubmission = !!recentlyCancelled;

  const [request] = await db
    .insert(dataDeletionRequestsTable)
    .values({ userId })
    .returning();

  // Mark deletion_requested_at on user record
  await db
    .update(usersTable)
    .set({ deletionRequestedAt: new Date() })
    .where(eq(usersTable.id, userId));

  // Create staff event visible to clinic_owner in activity feed
  const [patient] = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(eq(patientsTable.userId, userId))
    .limit(1);

  if (patient) {
    // Find clinic(s) this patient is enrolled in
    const enrollments = await db
      .select({ clinicId: patientClinicsTable.clinicId })
      .from(patientClinicsTable)
      .where(eq(patientClinicsTable.patientId, patient.id));

    const user = authResult.user;
    for (const enrollment of enrollments) {
      await db.insert(staffEventsTable).values({
        userId,
        clinicId: enrollment.clinicId,
        type: "patient_deletion_request",
        description: `${user.name} solicitou exclusão de dados (LGPD Art. 18). Prazo de 30 dias para aprovação.`,
      });
    }

    // Notify all clinic owners by email
    const clinicIds = enrollments.map((e) => e.clinicId);
    if (clinicIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const ownerRows = await db
        .select({
          ownerName: usersTable.name,
          ownerEmail: usersTable.email,
          clinicName: clinicsTable.name,
          clinicId: clinicsTable.id,
        })
        .from(clinicOwnersTable)
        .innerJoin(usersTable, eq(usersTable.id, clinicOwnersTable.userId))
        .innerJoin(clinicsTable, eq(clinicsTable.id, clinicOwnersTable.clinicId))
        .where(inArray(clinicOwnersTable.clinicId, clinicIds));

      const notifiedClinicIds = new Set(ownerRows.map((r) => r.clinicId));
      const unnotifiedClinicIds = clinicIds.filter((id) => !notifiedClinicIds.has(id));
      if (unnotifiedClinicIds.length > 0) {
        req.log.warn(
          { unnotifiedClinicIds, userId },
          "LGPD deletion request saved but no clinic owners found for some clinics — those patients will not be notified. Check clinicOwnersTable for these clinic IDs."
        );
      }

      // Deduplicate by owner email: a multi-clinic owner (who owns every clinic
      // the patient is enrolled in) should receive only one notification, not one
      // per clinic they own.
      const seenOwnerEmails = new Set<string>();
      const deduplicatedOwners = ownerRows.filter((owner) => {
        if (seenOwnerEmails.has(owner.ownerEmail)) return false;
        seenOwnerEmails.add(owner.ownerEmail);
        return true;
      });

      for (const owner of deduplicatedOwners) {
        try {
          await sendDeletionRequestNotificationEmail({
            to: owner.ownerEmail,
            ownerName: owner.ownerName ?? "Administrador",
            patientName: user.name ?? "Paciente",
            requestedAt: request.requestedAt,
            clinicName: owner.clinicName,
            isResubmission,
          });
        } catch (emailErr) {
          req.log.error({ err: emailErr, ownerEmail: owner.ownerEmail }, "Failed to send deletion request email to owner");
        }
      }
    }
  }

  res.status(201).json({
    id: request.id,
    requestedAt: request.requestedAt.toISOString(),
    message: "Solicitação de exclusão registrada. Nossa equipe entrará em contato em até 30 dias.",
  });
});

// ── GET /clinics/me/deletion-requests ── (clinic_owner sees pending deletion requests)
router.get("/clinics/me/deletion-requests", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner" && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Apenas administradores da clínica podem ver solicitações de exclusão." });
    return;
  }

  const clinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (!clinicId && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
    return;
  }

  // Find patients in this clinic who have pending deletion requests
  let patientUserIds: number[];
  if (clinicId) {
    const patientRows = await db
      .select({ userId: patientsTable.userId })
      .from(patientsTable)
      .innerJoin(patientClinicsTable, eq(patientClinicsTable.patientId, patientsTable.id))
      .where(eq(patientClinicsTable.clinicId, clinicId));
    patientUserIds = patientRows.map((r) => r.userId);
  } else {
    const allPatients = await db.select({ userId: patientsTable.userId }).from(patientsTable);
    patientUserIds = allPatients.map((r) => r.userId);
  }

  if (patientUserIds.length === 0) {
    res.json([]);
    return;
  }

  const { inArray } = await import("drizzle-orm");
  const requests = await db
    .select({
      request: dataDeletionRequestsTable,
      user: { id: usersTable.id, name: usersTable.name, email: usersTable.email },
    })
    .from(dataDeletionRequestsTable)
    .innerJoin(usersTable, eq(usersTable.id, dataDeletionRequestsTable.userId))
    .where(inArray(dataDeletionRequestsTable.userId, patientUserIds))
    .orderBy(desc(dataDeletionRequestsTable.requestedAt));

  res.json(
    requests.map(({ request, user: u }) => ({
      id: request.id,
      userId: request.userId,
      userName: u.name,
      userEmail: u.email,
      requestedAt: request.requestedAt.toISOString(),
      approvedAt: request.approvedAt?.toISOString() ?? null,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      approvedBy: request.approvedBy,
      notes: request.notes,
      status: request.approvedAt
        ? "approved"
        : request.cancelledAt
        ? "cancelled"
        : "pending",
    }))
  );
});

// ── PATCH /clinics/me/deletion-requests/:id ── (clinic_owner approves or cancels)
router.patch("/clinics/me/deletion-requests/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner" && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Apenas administradores da clínica podem gerenciar solicitações." });
    return;
  }

  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const parsed = z
    .object({
      action: z.enum(["approve", "cancel"]),
      notes: z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Ação inválida. Use 'approve' ou 'cancel'." });
    return;
  }

  const { action, notes } = parsed.data;

  const [request] = await db
    .select()
    .from(dataDeletionRequestsTable)
    .where(eq(dataDeletionRequestsTable.id, requestId))
    .limit(1);

  if (!request) {
    res.status(404).json({ error: "Solicitação não encontrada." });
    return;
  }

  if (request.approvedAt || request.cancelledAt) {
    res.status(409).json({ error: "Esta solicitação já foi processada." });
    return;
  }

  if (action === "cancel") {
    const [updated] = await db
      .update(dataDeletionRequestsTable)
      .set({ cancelledAt: new Date(), notes: notes ?? null })
      .where(eq(dataDeletionRequestsTable.id, requestId))
      .returning();

    // Clear deletion_requested_at on user
    await db
      .update(usersTable)
      .set({ deletionRequestedAt: null })
      .where(eq(usersTable.id, request.userId));

    res.json({ id: updated.id, status: "cancelled", cancelledAt: updated.cancelledAt?.toISOString() ?? null });
    return;
  }

  // Approve: anonymize PII fields while keeping statistical data
  const [updated] = await db
    .update(dataDeletionRequestsTable)
    .set({ approvedAt: new Date(), approvedBy: authResult.user.id, notes: notes ?? null })
    .where(eq(dataDeletionRequestsTable.id, requestId))
    .returning();

  // Anonymize patient PII
  const [patient] = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(eq(patientsTable.userId, request.userId))
    .limit(1);

  if (patient) {
    await db
      .update(patientsTable)
      .set({
        cpf: null,
        rg: null,
        phone: null,
        addressStreet: null,
        addressNumber: null,
        addressComplement: null,
        addressNeighborhood: null,
        addressCity: null,
        addressState: null,
        addressZip: null,
        medicalConditions: null,
        psychologyNotes: null,
        physicalActivityNotes: null,
        endocrinologyNotes: null,
        allergies: null,
        dietaryRestrictions: null,
      })
      .where(eq(patientsTable.id, patient.id));
  }

  // Anonymize user PII
  const anonymizedEmail = `deleted_${request.userId}_${Date.now()}@anonymized.local`;
  await db
    .update(usersTable)
    .set({
      name: "[Dados removidos]",
      email: anonymizedEmail,
      passwordHash: null,
      avatarUrl: null,
      deletionRequestedAt: null,
      deactivatedAt: new Date(),
    })
    .where(eq(usersTable.id, request.userId));

  res.json({ id: updated.id, status: "approved", approvedAt: updated.approvedAt?.toISOString() ?? null });
});

// ── GET /clinics/me/access-logs ── (clinic_owner / super_admin reads data access log)
router.get("/clinics/me/access-logs", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner" && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Apenas administradores podem acessar o log de acesso a dados." });
    return;
  }

  const clinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (!clinicId && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
    return;
  }

  const patientIdParam = req.query.patientId ? parseInt(req.query.patientId as string, 10) : undefined;
  const fromDate = req.query.from ? new Date(req.query.from as string) : undefined;
  const toDate = req.query.to ? new Date(req.query.to as string) : undefined;
  const limitParam = Math.min(parseInt(req.query.limit as string ?? "100", 10) || 100, 500);

  const { and: andOp, eq: eqOp, gte, lte } = await import("drizzle-orm");

  const conditions = [];
  if (clinicId) conditions.push(eqOp(dataAccessLogTable.clinicId, clinicId));
  if (patientIdParam) conditions.push(eqOp(dataAccessLogTable.patientId, patientIdParam));
  if (fromDate) conditions.push(gte(dataAccessLogTable.accessedAt, fromDate));
  if (toDate) conditions.push(lte(dataAccessLogTable.accessedAt, toDate));

  const logs = await db
    .select({
      log: dataAccessLogTable,
      accessorUser: { id: usersTable.id, name: usersTable.name, email: usersTable.email },
      patientUser: { id: patientsTable.id },
    })
    .from(dataAccessLogTable)
    .innerJoin(usersTable, eqOp(usersTable.id, dataAccessLogTable.accessorUserId))
    .innerJoin(patientsTable, eqOp(patientsTable.id, dataAccessLogTable.patientId))
    .where(conditions.length > 0 ? andOp(...(conditions as [any, ...any[]])) : undefined)
    .orderBy(desc(dataAccessLogTable.accessedAt))
    .limit(limitParam);

  // Fetch patient names separately
  const { inArray } = await import("drizzle-orm");
  const patientIds = [...new Set(logs.map((l) => l.log.patientId))];
  const patientUserRows = patientIds.length
    ? await db
        .select({ patientId: patientsTable.id, userId: patientsTable.userId, name: usersTable.name })
        .from(patientsTable)
        .innerJoin(usersTable, eqOp(usersTable.id, patientsTable.userId))
        .where(inArray(patientsTable.id, patientIds))
    : [];
  const patientNameMap = new Map(patientUserRows.map((p) => [p.patientId, p.name]));

  res.json(
    logs.map(({ log, accessorUser }) => ({
      id: log.id,
      accessorUserId: log.accessorUserId,
      accessorName: accessorUser.name,
      accessorRole: log.accessorRole,
      patientId: log.patientId,
      patientName: patientNameMap.get(log.patientId) ?? "—",
      clinicId: log.clinicId,
      fieldsAccessed: log.fieldsAccessed,
      accessedAt: log.accessedAt.toISOString(),
    }))
  );
});

// ── GET /clinics/me/audit-failures ── (clinic_owner sees unresolved audit write failures)
router.get("/clinics/me/audit-failures", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner" && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Apenas administradores podem acessar o log de falhas de auditoria." });
    return;
  }

  const clinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (!clinicId && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
    return;
  }

  const { count: countFn, and: andOp } = await import("drizzle-orm");

  // Only show unresolved failures
  const unresolvedCondition = isNull(auditFailuresTable.resolvedAt);
  const baseCondition = clinicId
    ? andOp(eq(auditFailuresTable.clinicId, clinicId), unresolvedCondition)
    : unresolvedCondition;

  const [countRow] = await db
    .select({ count: countFn() })
    .from(auditFailuresTable)
    .where(baseCondition);

  const limitParam = Math.min(parseInt(req.query.limit as string ?? "20", 10) || 20, 100);

  const items = await db
    .select({
      failure: auditFailuresTable,
      accessorName: usersTable.name,
    })
    .from(auditFailuresTable)
    .leftJoin(usersTable, eq(usersTable.id, auditFailuresTable.accessorUserId))
    .where(baseCondition)
    .orderBy(desc(auditFailuresTable.failedAt))
    .limit(limitParam);

  res.json({
    count: Number(countRow?.count ?? 0),
    recent: items.map(({ failure, accessorName }) => ({
      id: failure.id,
      clinicId: failure.clinicId,
      accessorUserId: failure.accessorUserId,
      accessorName: accessorName ?? null,
      accessorRole: failure.accessorRole,
      patientId: failure.patientId,
      fieldsAccessed: failure.fieldsAccessed,
      errorMessage: failure.errorMessage,
      failedAt: failure.failedAt.toISOString(),
      resolvedAt: failure.resolvedAt?.toISOString() ?? null,
      resolvedBy: failure.resolvedBy ?? null,
      ownerNotifiedAt: failure.ownerNotifiedAt?.toISOString() ?? null,
    })),
  });
});

// ── PATCH /clinics/me/audit-failures/:id/resolve ── (clinic_owner marks a failure as investigated)
router.patch("/clinics/me/audit-failures/:id/resolve", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner" && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Apenas administradores podem marcar falhas como investigadas." });
    return;
  }

  const clinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (!clinicId && authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
    return;
  }

  const failureId = parseInt(req.params.id, 10);
  if (isNaN(failureId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [failure] = await db
    .select()
    .from(auditFailuresTable)
    .where(eq(auditFailuresTable.id, failureId))
    .limit(1);

  if (!failure) {
    res.status(404).json({ error: "Falha de auditoria não encontrada." });
    return;
  }

  // Ensure the failure belongs to this owner's clinic (skip check for super_admin)
  if (clinicId && failure.clinicId !== clinicId) {
    res.status(403).json({ error: "Sem permissão para acessar esta falha." });
    return;
  }

  if (failure.resolvedAt) {
    res.status(409).json({ error: "Esta falha já foi marcada como investigada." });
    return;
  }

  const [updated] = await db
    .update(auditFailuresTable)
    .set({ resolvedAt: new Date(), resolvedBy: authResult.user.id })
    .where(eq(auditFailuresTable.id, failureId))
    .returning();

  // Fetch accessor name for response
  const [accessorUser] = updated.accessorUserId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.accessorUserId)).limit(1)
    : [];

  res.json({
    id: updated.id,
    clinicId: updated.clinicId,
    accessorUserId: updated.accessorUserId,
    accessorName: accessorUser?.name ?? null,
    accessorRole: updated.accessorRole,
    patientId: updated.patientId,
    fieldsAccessed: updated.fieldsAccessed,
    errorMessage: updated.errorMessage,
    failedAt: updated.failedAt.toISOString(),
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    resolvedBy: updated.resolvedBy ?? null,
    ownerNotifiedAt: updated.ownerNotifiedAt?.toISOString() ?? null,
  });
});

export default router;
