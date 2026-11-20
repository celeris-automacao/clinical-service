import { Router } from "express";
import { eq, and, inArray, sql, desc, or, isNull } from "drizzle-orm";
import {
  db,
  formsTable,
  formQuestionsTable,
  formAssignmentsTable,
  formResponsesTable,
  formResponseAnswersTable,
  patientsTable,
  patientClinicsTable,
  clinicOwnersTable,
  doctorsTable,
  secretariesTable,
  staffEventsTable,
} from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess, resolveOwnerClinicId } from "../lib/auth-helpers";
import { z } from "zod/v4";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

async function resolveStaffClinicId(user: { id: number; role: string }, jwtClinicId?: number): Promise<number | null> {
  if (user.role === "clinic_owner") {
    return (await resolveOwnerClinicId(user.id, jwtClinicId)) ?? null;
  }
  if (user.role === "profissional_saude") {
    const [row] = await db.select({ clinicId: doctorsTable.clinicId }).from(doctorsTable).where(eq(doctorsTable.userId, user.id)).limit(1);
    return row?.clinicId ?? null;
  }
  if (user.role === "secretaria") {
    const [row] = await db.select({ clinicId: secretariesTable.clinicId }).from(secretariesTable).where(eq(secretariesTable.userId, user.id)).limit(1);
    return row?.clinicId ?? null;
  }
  return null;
}

async function getFormWithQuestions(formId: number) {
  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!form) return null;
  const questions = await db
    .select()
    .from(formQuestionsTable)
    .where(eq(formQuestionsTable.formId, formId))
    .orderBy(formQuestionsTable.orderIndex);
  return { ...form, questions };
}

function buildFormDetailResponse(form: typeof formsTable.$inferSelect & { questions: (typeof formQuestionsTable.$inferSelect)[] }) {
  return {
    id: form.id,
    clinicId: form.clinicId,
    title: form.title,
    description: form.description ?? null,
    isMandatory: form.isMandatory,
    isActive: form.isActive,
    questions: form.questions.map((q) => ({
      id: q.id,
      formId: q.formId,
      text: q.text,
      questionType: q.questionType,
      options: (q.options as string[] | null) ?? null,
      orderIndex: q.orderIndex,
    })),
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  };
}

// ── GET /forms ─────────────────────────────────────────────────────────────────
router.get("/forms", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }
  if (!["clinic_owner", "profissional_saude", "secretaria"].includes(user.role)) {
    res.status(403).json({ error: "Acesso restrito a profissionais de saúde" }); return;
  }

  const forms = await db.select().from(formsTable).where(eq(formsTable.clinicId, clinicId)).orderBy(desc(formsTable.createdAt));

  const result = await Promise.all(forms.map(async (form) => {
    const [{ count: qCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(formQuestionsTable)
      .where(eq(formQuestionsTable.formId, form.id));
    const [{ count: rCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(formResponsesTable)
      .where(eq(formResponsesTable.formId, form.id));
    return {
      id: form.id,
      clinicId: form.clinicId,
      title: form.title,
      description: form.description ?? null,
      isMandatory: form.isMandatory,
      isActive: form.isActive,
      questionCount: Number(qCount),
      responseCount: Number(rCount),
      createdAt: form.createdAt.toISOString(),
    };
  }));

  res.json(result);
});

// ── POST /forms ────────────────────────────────────────────────────────────────
const CreateFormSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  isMandatory: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

router.post("/forms", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;

  if (!["clinic_owner", "profissional_saude"].includes(user.role)) {
    res.status(403).json({ error: "Apenas clinic_owner e profissional_saude podem criar formulários" }); return;
  }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }

  const parsed = CreateFormSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [form] = await db
    .insert(formsTable)
    .values({ clinicId, createdByUserId: user.id, title: parsed.data.title, description: parsed.data.description ?? null, isMandatory: parsed.data.isMandatory, isActive: parsed.data.isActive })
    .returning();

  const full = await getFormWithQuestions(form!.id);
  res.status(201).json(buildFormDetailResponse(full!));
});

// ── GET /forms/:formId ─────────────────────────────────────────────────────────
router.get("/forms/:formId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId || !["clinic_owner", "profissional_saude", "secretaria"].includes(user.role)) {
    res.status(403).json({ error: "Acesso restrito a profissionais de saúde" }); return;
  }

  const full = await getFormWithQuestions(formId);
  if (!full || full.clinicId !== clinicId) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  res.json(buildFormDetailResponse(full));
});

// ── PUT /forms/:formId ─────────────────────────────────────────────────────────
const UpdateFormSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.union([z.string(), z.null()]).optional(),
  isMandatory: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.put("/forms/:formId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);

  if (!["clinic_owner", "profissional_saude"].includes(user.role)) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }

  const [existing] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!existing || existing.clinicId !== clinicId) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  const parsed = UpdateFormSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Partial<typeof formsTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.isMandatory !== undefined) updates.isMandatory = parsed.data.isMandatory;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  await db.update(formsTable).set(updates).where(eq(formsTable.id, formId));

  const full = await getFormWithQuestions(formId);
  res.json(buildFormDetailResponse(full!));
});

// ── DELETE /forms/:formId ──────────────────────────────────────────────────────
router.delete("/forms/:formId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);

  if (user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas clinic_owner pode excluir formulários" }); return;
  }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }

  const [existing] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!existing || existing.clinicId !== clinicId) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  await db.delete(formsTable).where(eq(formsTable.id, formId));
  res.status(204).send();
});

// ── POST /forms/:formId/questions ──────────────────────────────────────────────
const CreateQuestionSchema = z.object({
  text: z.string().trim().min(1),
  questionType: z.enum(["yes_no", "text", "multiple_choice"]),
  options: z.array(z.string().trim().min(1).refine((value) => !value.includes("|"), "Alternativas não podem conter |")).optional(),
  orderIndex: z.number().int().optional(),
});

router.post("/forms/:formId/questions", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);

  if (!["clinic_owner", "profissional_saude"].includes(user.role)) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }

  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!form || form.clinicId !== clinicId) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  const parsed = CreateQuestionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.questionType === "multiple_choice" && (!parsed.data.options || parsed.data.options.length < 2 || new Set(parsed.data.options).size !== parsed.data.options.length)) {
    res.status(400).json({ error: "Perguntas de múltipla escolha precisam de pelo menos duas alternativas diferentes" }); return;
  }

  const [{ maxIdx }] = await db
    .select({ maxIdx: sql<number>`coalesce(max(${formQuestionsTable.orderIndex}), -1)` })
    .from(formQuestionsTable)
    .where(eq(formQuestionsTable.formId, formId));

  const [question] = await db
    .insert(formQuestionsTable)
    .values({
      formId,
      text: parsed.data.text,
      questionType: parsed.data.questionType,
      options: parsed.data.questionType === "multiple_choice" ? parsed.data.options : null,
      orderIndex: parsed.data.orderIndex ?? (Number(maxIdx) + 1),
    })
    .returning();

  res.status(201).json({
    id: question!.id,
    formId: question!.formId,
    text: question!.text,
    questionType: question!.questionType,
    options: (question!.options as string[] | null) ?? null,
    orderIndex: question!.orderIndex,
  });
});

// ── PATCH /forms/:formId/questions/:questionId ─────────────────────────────────
const UpdateQuestionSchema = CreateQuestionSchema.partial().extend({
  options: CreateQuestionSchema.shape.options.nullable(),
});

router.patch("/forms/:formId/questions/:questionId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);
  const questionId = Number(req.params.questionId);

  if (!["clinic_owner", "profissional_saude"].includes(user.role)) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }

  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!form || form.clinicId !== clinicId) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  const [question] = await db
    .select()
    .from(formQuestionsTable)
    .where(and(eq(formQuestionsTable.id, questionId), eq(formQuestionsTable.formId, formId)))
    .limit(1);
  if (!question) { res.status(404).json({ error: "Pergunta não encontrada" }); return; }

  const parsed = UpdateQuestionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Nenhum campo para atualizar" }); return;
  }

  const questionType = parsed.data.questionType ?? question.questionType;
  const options = parsed.data.options !== undefined ? parsed.data.options : question.options;
  if (questionType === "multiple_choice" && (!options || options.length < 2 || new Set(options).size !== options.length)) {
    res.status(400).json({ error: "Perguntas de múltipla escolha precisam de pelo menos duas alternativas diferentes" }); return;
  }

  const updates: Partial<typeof formQuestionsTable.$inferInsert> = {};
  if (parsed.data.text !== undefined) updates.text = parsed.data.text;
  if (parsed.data.orderIndex !== undefined) updates.orderIndex = parsed.data.orderIndex;
  if (parsed.data.questionType !== undefined) updates.questionType = parsed.data.questionType;
  if (parsed.data.options !== undefined || parsed.data.questionType !== undefined) {
    updates.options = questionType === "multiple_choice" ? options : null;
  }

  const [updated] = await db
    .update(formQuestionsTable)
    .set(updates)
    .where(eq(formQuestionsTable.id, questionId))
    .returning();

  res.json({
    id: updated!.id,
    formId: updated!.formId,
    text: updated!.text,
    questionType: updated!.questionType,
    options: (updated!.options as string[] | null) ?? null,
    orderIndex: updated!.orderIndex,
  });
});

// ── DELETE /forms/:formId/questions/:questionId ────────────────────────────────
router.delete("/forms/:formId/questions/:questionId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);
  const questionId = Number(req.params.questionId);

  if (!["clinic_owner", "profissional_saude"].includes(user.role)) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }

  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!form || form.clinicId !== clinicId) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  const [question] = await db
    .select()
    .from(formQuestionsTable)
    .where(and(eq(formQuestionsTable.id, questionId), eq(formQuestionsTable.formId, formId)))
    .limit(1);
  if (!question) { res.status(404).json({ error: "Pergunta não encontrada" }); return; }

  await db.delete(formQuestionsTable).where(eq(formQuestionsTable.id, questionId));
  res.status(204).send();
});

// ── POST /forms/:formId/assignments ───────────────────────────────────────────
const AssignFormSchema = z.object({
  patientId: z.union([z.number().int().positive(), z.null()]).optional(),
});

router.post("/forms/:formId/assignments", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);

  if (!["clinic_owner", "profissional_saude"].includes(user.role)) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }

  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!form || form.clinicId !== clinicId) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  const parsed = AssignFormSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const patientId = parsed.data.patientId ?? null;

  // Check for duplicate assignment
  const existing = await db
    .select()
    .from(formAssignmentsTable)
    .where(
      and(
        eq(formAssignmentsTable.formId, formId),
        patientId === null ? isNull(formAssignmentsTable.patientId) : eq(formAssignmentsTable.patientId, patientId)
      )
    )
    .limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "Formulário já atribuído" }); return; }

  const [assignment] = await db
    .insert(formAssignmentsTable)
    .values({ formId, patientId })
    .returning();

  res.status(201).json({ id: assignment!.id, formId: assignment!.formId, patientId: assignment!.patientId ?? null });
});

// ── Helper: check if a patient is assigned this form ──────────────────────────
async function isFormAssignedToPatient(formId: number, patientId: number, clinicId: number): Promise<boolean> {
  // Check direct assignment or all-clinic assignment
  const assignments = await db
    .select()
    .from(formAssignmentsTable)
    .where(
      and(
        eq(formAssignmentsTable.formId, formId),
        or(
          eq(formAssignmentsTable.patientId, patientId),
          isNull(formAssignmentsTable.patientId)
        )
      )
    )
    .limit(1);

  if (assignments.length === 0) return false;

  // For all-clinic assignments, verify patient is in the clinic
  const nullAssignment = assignments.find((a) => a.patientId === null);
  if (nullAssignment) {
    const enrollment = await db
      .select()
      .from(patientClinicsTable)
      .where(and(eq(patientClinicsTable.patientId, patientId), eq(patientClinicsTable.clinicId, clinicId)))
      .limit(1);
    return enrollment.length > 0;
  }

  return true;
}

// ── GET /patients/:patientId/forms ─────────────────────────────────────────────
router.get("/patients/:patientId/forms", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const patientId = Number(req.params.patientId);

  const patient = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!patient) { res.status(403).json({ error: "Acesso negado" }); return; }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId && user.role !== "patient") { res.status(403).json({ error: "Clínica não encontrada" }); return; }

  // Get the patient's clinic enrollment
  const [enrollment] = await db
    .select({ clinicId: patientClinicsTable.clinicId })
    .from(patientClinicsTable)
    .where(eq(patientClinicsTable.patientId, patientId))
    .limit(1);

  const effectiveClinicId = clinicId ?? enrollment?.clinicId;
  if (!effectiveClinicId) { res.json([]); return; }

  await buildPatientFormsResponse(res, patientId, effectiveClinicId);
});

async function buildPatientFormsResponse(
  res: import("express").Response,
  patientId: number,
  clinicId: number,
  filters?: { mandatory?: boolean; answered?: boolean }
) {
  // Get all active forms for this clinic
  const allForms = await db
    .select()
    .from(formsTable)
    .where(and(eq(formsTable.clinicId, clinicId), eq(formsTable.isActive, true)));

  // For each form, check if it's assigned to this patient
  const assignedForms: typeof allForms = [];
  for (const form of allForms) {
    const assigned = await isFormAssignedToPatient(form.id, patientId, clinicId);
    if (assigned) assignedForms.push(form);
  }

  // Get patient's responses
  const responseRows = assignedForms.length
    ? await db
        .select()
        .from(formResponsesTable)
        .where(and(eq(formResponsesTable.patientId, patientId), inArray(formResponsesTable.formId, assignedForms.map((f) => f.id))))
    : [];
  const responseMap = new Map(responseRows.map((r) => [r.formId, r]));

  // Get questions for all forms
  const questionRows = assignedForms.length
    ? await db
        .select()
        .from(formQuestionsTable)
        .where(inArray(formQuestionsTable.formId, assignedForms.map((f) => f.id)))
        .orderBy(formQuestionsTable.orderIndex)
    : [];
  const questionsMap = new Map<number, typeof questionRows>();
  for (const q of questionRows) {
    if (!questionsMap.has(q.formId)) questionsMap.set(q.formId, []);
    questionsMap.get(q.formId)!.push(q);
  }

  let result = assignedForms.map((form) => {
    const response = responseMap.get(form.id);
    return {
      formId: form.id,
      title: form.title,
      description: form.description ?? null,
      isMandatory: form.isMandatory,
      isActive: form.isActive,
      answered: !!response,
      submittedAt: response ? response.submittedAt.toISOString() : null,
      questions: (questionsMap.get(form.id) ?? []).map((q) => ({
        id: q.id,
        formId: q.formId,
        text: q.text,
        questionType: q.questionType,
        options: (q.options as string[] | null) ?? null,
        orderIndex: q.orderIndex,
      })),
    };
  });

  if (filters?.mandatory !== undefined) {
    result = result.filter((f) => f.isMandatory === filters.mandatory);
  }
  if (filters?.answered !== undefined) {
    result = result.filter((f) => f.answered === filters.answered);
  }

  res.json(result);
}

// ── GET /patients/me/forms ─────────────────────────────────────────────────────
router.get("/patients/me/forms", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;

  if (user.role !== "patient") { res.status(403).json({ error: "Apenas pacientes" }); return; }

  const [patientRow] = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
  if (!patientRow) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  const [enrollment] = await db
    .select({ clinicId: patientClinicsTable.clinicId })
    .from(patientClinicsTable)
    .where(eq(patientClinicsTable.patientId, patientRow.id))
    .limit(1);
  if (!enrollment) { res.json([]); return; }

  const mandatory = req.query.mandatory !== undefined ? req.query.mandatory === "true" : undefined;
  const answered = req.query.answered !== undefined ? req.query.answered === "true" : undefined;

  await buildPatientFormsResponse(res, patientRow.id, enrollment.clinicId, { mandatory, answered });
});

// ── POST /forms/:formId/responses ──────────────────────────────────────────────
const SubmitResponseSchema = z.object({
  answers: z.array(z.object({ questionId: z.number().int(), answer: z.string() })).min(1),
});

router.post("/forms/:formId/responses", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);

  if (user.role !== "patient") { res.status(403).json({ error: "Apenas pacientes podem responder formulários" }); return; }

  const [patientRow] = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
  if (!patientRow) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!form) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  // Check if already answered
  const [existing] = await db
    .select()
    .from(formResponsesTable)
    .where(and(eq(formResponsesTable.formId, formId), eq(formResponsesTable.patientId, patientRow.id)))
    .limit(1);
  if (existing) { res.status(409).json({ error: "Formulário já respondido" }); return; }

  // Verify patient is assigned this form
  const [enrollment] = await db
    .select({ clinicId: patientClinicsTable.clinicId })
    .from(patientClinicsTable)
    .where(eq(patientClinicsTable.patientId, patientRow.id))
    .limit(1);
  if (!enrollment) { res.status(403).json({ error: "Paciente não está em nenhuma clínica" }); return; }

  const assigned = await isFormAssignedToPatient(formId, patientRow.id, enrollment.clinicId);
  if (!assigned) { res.status(403).json({ error: "Formulário não atribuído a este paciente" }); return; }

  const parsed = SubmitResponseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [response] = await db
    .insert(formResponsesTable)
    .values({ formId, patientId: patientRow.id })
    .returning();

  if (parsed.data.answers.length > 0) {
    await db.insert(formResponseAnswersTable).values(
      parsed.data.answers.map((a) => ({ responseId: response!.id, questionId: a.questionId, answer: a.answer }))
    );
  }

  await db.insert(staffEventsTable).values({
    userId: user.id,
    clinicId: enrollment.clinicId,
    type: "form_response_submitted",
    description: `Enviou respostas para o formulário "${form.title}"`,
  });

  res.status(201).json({
    id: response!.id,
    formId: response!.formId,
    patientId: response!.patientId,
    submittedAt: response!.submittedAt.toISOString(),
  });
});

// ── GET /forms/:formId/responses/:patientId ────────────────────────────────────
router.get("/forms/:formId/responses/:patientId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;
  const formId = Number(req.params.formId);
  const patientId = Number(req.params.patientId);

  if (!["clinic_owner", "profissional_saude", "secretaria"].includes(user.role)) {
    res.status(403).json({ error: "Acesso restrito a profissionais" }); return;
  }

  const clinicId = await resolveStaffClinicId(user, authResult.clinicId);
  if (!clinicId) { res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica" }); return; }

  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
  if (!form || form.clinicId !== clinicId) { res.status(404).json({ error: "Formulário não encontrado" }); return; }

  const [response] = await db
    .select()
    .from(formResponsesTable)
    .where(and(eq(formResponsesTable.formId, formId), eq(formResponsesTable.patientId, patientId)))
    .limit(1);
  if (!response) { res.status(404).json({ error: "Resposta não encontrada" }); return; }

  const answers = await db
    .select()
    .from(formResponseAnswersTable)
    .where(eq(formResponseAnswersTable.responseId, response.id));

  const questions = await db
    .select()
    .from(formQuestionsTable)
    .where(eq(formQuestionsTable.formId, formId))
    .orderBy(formQuestionsTable.orderIndex);

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  res.json({
    id: response.id,
    formId: response.formId,
    patientId: response.patientId,
    submittedAt: response.submittedAt.toISOString(),
    answers: answers.map((a) => {
      const q = questionMap.get(a.questionId);
      return {
        questionId: a.questionId,
        questionText: q?.text ?? "",
        questionType: q?.questionType ?? "text",
        answer: a.answer,
      };
    }),
  });
});

export default router;
