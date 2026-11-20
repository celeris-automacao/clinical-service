import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, leadsTable, usersTable, doctorsTable, staffEventsTable, patientClinicsTable, patientsTable } from "@workspace/db";
import { requireAuth, isError, resolveCallerClinicId } from "../lib/auth-helpers";
import { CreateLeadBody, UpdateLeadBody, UpdateLeadStageBody } from "@workspace/api-zod";

const router = Router();

const STAFF_ROLES = new Set(["clinic_owner", "profissional_saude", "secretaria"]);

const STAGE_LABELS: Record<string, string> = {
  novo: "Novo",
  contatado: "Contatado",
  agendado: "Agendado",
  convertido: "Convertido",
  perdido: "Perdido",
};

function buildLeadResponse(lead: typeof leadsTable.$inferSelect, authorName: string) {
  return {
    id: lead.id,
    clinicId: lead.clinicId,
    name: lead.name,
    contact: lead.contact,
    source: lead.source,
    status: lead.status,
    notes: lead.notes,
    paymentType: lead.paymentType,
    insuranceName: lead.insuranceName,
    convertedPatientId: lead.convertedPatientId,
    authorUserId: lead.authorUserId,
    authorName,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

async function fetchAuthorName(userId: number): Promise<string> {
  const [author] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return author?.name ?? "";
}

async function isPatientInClinic(patientId: number, clinicId: number): Promise<boolean> {
  const [enrollment] = await db
    .select({ patientId: patientClinicsTable.patientId })
    .from(patientClinicsTable)
    .where(and(eq(patientClinicsTable.patientId, patientId), eq(patientClinicsTable.clinicId, clinicId)))
    .limit(1);
  return !!enrollment;
}

router.get("/leads", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (!STAFF_ROLES.has(user.role)) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const validStatuses = leadsTable.status.enumValues as readonly string[];
  if (status !== undefined && !validStatuses.includes(status)) {
    res.status(400).json({ error: "Status de lead inválido." });
    return;
  }
  const conditions = [eq(leadsTable.clinicId, clinicId)];
  if (status) {
    conditions.push(eq(leadsTable.status, status as (typeof leadsTable.status.enumValues)[number]));
  }

  const rows = await db
    .select()
    .from(leadsTable)
    .where(and(...conditions))
    .orderBy(desc(leadsTable.createdAt));

  const results = await Promise.all(
    rows.map(async (lead) => buildLeadResponse(lead, await fetchAuthorName(lead.authorUserId)))
  );
  res.json(results);
});

router.post("/leads", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (!STAFF_ROLES.has(user.role)) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [inserted] = await db
    .insert(leadsTable)
    .values({
      clinicId,
      name: parsed.data.name,
      contact: parsed.data.contact ?? null,
      source: parsed.data.source ?? null,
      status: parsed.data.status ?? "novo",
      notes: parsed.data.notes ?? null,
      paymentType: parsed.data.paymentType ?? "particular",
      insuranceName: parsed.data.paymentType === "convenio" ? (parsed.data.insuranceName ?? null) : null,
      authorUserId: user.id,
    })
    .returning();

  await db.insert(staffEventsTable).values({
    userId: user.id,
    clinicId,
    type: "lead_created",
    description: `${user.name} adicionou o lead "${inserted.name}" ao funil.`,
  });

  res.status(201).json(buildLeadResponse(inserted, user.name));
});

router.get("/leads/:leadId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (!STAFF_ROLES.has(user.role)) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const leadId = Number(req.params.leadId);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!lead || lead.clinicId !== clinicId) {
    res.status(404).json({ error: "Lead não encontrado" });
    return;
  }

  res.json(buildLeadResponse(lead, await fetchAuthorName(lead.authorUserId)));
});

router.patch("/leads/:leadId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (!STAFF_ROLES.has(user.role)) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const leadId = Number(req.params.leadId);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!lead || lead.clinicId !== clinicId) {
    res.status(404).json({ error: "Lead não encontrado" });
    return;
  }

  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.convertedPatientId !== undefined && !(await isPatientInClinic(parsed.data.convertedPatientId, clinicId))) {
    res.status(400).json({ error: "Paciente inválido para esta clínica." });
    return;
  }

  const nextPaymentType = parsed.data.paymentType ?? lead.paymentType;
  const [updated] = await db
    .update(leadsTable)
    .set({
      ...parsed.data,
      ...(parsed.data.paymentType !== undefined
        ? { insuranceName: nextPaymentType === "convenio" ? (parsed.data.insuranceName ?? lead.insuranceName ?? null) : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, leadId))
    .returning();

  res.json(buildLeadResponse(updated, await fetchAuthorName(updated.authorUserId)));
});

router.delete("/leads/:leadId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (!STAFF_ROLES.has(user.role)) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const leadId = Number(req.params.leadId);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!lead || lead.clinicId !== clinicId) {
    res.status(404).json({ error: "Lead não encontrado" });
    return;
  }

  await db.delete(leadsTable).where(eq(leadsTable.id, leadId));
  res.status(204).send();
});

router.patch("/leads/:leadId/stage", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (!STAFF_ROLES.has(user.role)) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const leadId = Number(req.params.leadId);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!lead || lead.clinicId !== clinicId) {
    res.status(404).json({ error: "Lead não encontrado" });
    return;
  }

  const parsed = UpdateLeadStageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.convertedPatientId !== undefined && !(await isPatientInClinic(parsed.data.convertedPatientId, clinicId))) {
    res.status(400).json({ error: "Paciente inválido para esta clínica." });
    return;
  }

  const [updated] = await db
    .update(leadsTable)
    .set({
      status: parsed.data.status,
      convertedPatientId: parsed.data.convertedPatientId ?? lead.convertedPatientId,
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, leadId))
    .returning();

  // Converting a lead into a patient copies the lead's payment/insurance info
  // onto the patient record, so the clinic doesn't need to re-enter it.
  if (updated.status === "convertido" && updated.convertedPatientId) {
    await db
      .update(patientsTable)
      .set({ paymentType: updated.paymentType, insuranceName: updated.insuranceName })
      .where(eq(patientsTable.id, updated.convertedPatientId));
  }

  await db.insert(staffEventsTable).values({
    userId: user.id,
    clinicId,
    type: "lead_stage_changed",
    description: `${user.name} moveu o lead "${updated.name}" para ${STAGE_LABELS[updated.status] ?? updated.status}.`,
  });

  res.json(buildLeadResponse(updated, await fetchAuthorName(updated.authorUserId)));
});

export default router;
