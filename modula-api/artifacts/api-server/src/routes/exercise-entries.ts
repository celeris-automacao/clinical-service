import { Router } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, exerciseEntriesTable, patientsTable } from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess } from "../lib/auth-helpers";
import { maybeAwardXp } from "../lib/xp-helpers";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import { z } from "zod/v4";

const router = Router();

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  durationMin: z.number().int().min(1).max(1440).optional(),
  photoUrl: z.string().optional(),
});

async function getPatientIdForUser(userId: number): Promise<number | null> {
  const [p] = await db.select({ id: patientsTable.id }).from(patientsTable).where(eq(patientsTable.userId, userId)).limit(1);
  return p?.id ?? null;
}

async function estimateCalories(description: string): Promise<number | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 64,
      messages: [
        {
          role: "system",
          content: "Você é um personal trainer especializado em metabolismo. Responda apenas com um número inteiro representando kcal estimados gastos. Sem unidades, sem texto extra.",
        },
        { role: "user", content: `Atividade: ${description}` },
      ],
    });
    const text = (completion.choices[0]?.message?.content ?? "").trim();
    const num = parseInt(text.replace(/\D/g, ""), 10);
    return isNaN(num) ? null : num;
  } catch (err) {
    logger.error({ err }, "exercise calorie estimation failed");
    return null;
  }
}

router.get("/exercise-entries", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;

  let patientId: number;

  if (user.role === "patient") {
    const pid = await getPatientIdForUser(user.id);
    if (!pid) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
    patientId = pid;
  } else {
    const raw = req.query.patientId;
    if (!raw) { res.status(400).json({ error: "patientId obrigatório" }); return; }
    patientId = Number(raw);
    const access = await ensurePatientAccess(user, patientId, authResult.clinicId);
    if (!access) { res.status(403).json({ error: "Acesso negado" }); return; }
  }

  const { date, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
  const effectiveFrom = date ?? dateFrom;
  const effectiveTo = date ?? dateTo;

  const conditions = [eq(exerciseEntriesTable.patientId, patientId)];
  if (effectiveFrom) conditions.push(gte(exerciseEntriesTable.date, effectiveFrom));
  if (effectiveTo) conditions.push(lte(exerciseEntriesTable.date, effectiveTo));

  const rows = await db
    .select()
    .from(exerciseEntriesTable)
    .where(and(...conditions))
    .orderBy(desc(exerciseEntriesTable.createdAt));

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/exercise-entries", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }

  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem registrar exercícios" });
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.prettifyError(parsed.error) }); return; }

  const patientId = await getPatientIdForUser(authResult.user.id);
  if (!patientId) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  // Estimate calories synchronously so entry is stored with AI data
  const calorieEstimate = await estimateCalories(parsed.data.description);

  const [row] = await db
    .insert(exerciseEntriesTable)
    .values({
      patientId,
      date: parsed.data.date,
      description: parsed.data.description,
      durationMin: parsed.data.durationMin ?? null,
      photoUrl: parsed.data.photoUrl ?? null,
      calorieEstimate,
    })
    .returning();

  // Award XP for first exercise entry of the day (also evaluates weekly bonus)
  await maybeAwardXp(patientId, parsed.data.date, "exercise");

  res.status(201).json({ ...row!, createdAt: row!.createdAt.toISOString() });
});

router.delete("/exercise-entries/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;

  const entryId = Number(req.params.id);
  const [entry] = await db.select().from(exerciseEntriesTable).where(eq(exerciseEntriesTable.id, entryId)).limit(1);
  if (!entry) { res.status(404).json({ error: "Entrada não encontrada" }); return; }

  if (user.role === "patient") {
    const pid = await getPatientIdForUser(user.id);
    if (pid !== entry.patientId) { res.status(403).json({ error: "Acesso negado" }); return; }
  } else {
    const access = await ensurePatientAccess(user, entry.patientId, authResult.clinicId);
    if (!access) { res.status(403).json({ error: "Acesso negado" }); return; }
  }

  await db.delete(exerciseEntriesTable).where(eq(exerciseEntriesTable.id, entryId));
  res.status(204).end();
});

router.post("/exercise-entries/:id/analyze", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;

  const entryId = Number(req.params.id);
  const [entry] = await db.select().from(exerciseEntriesTable).where(eq(exerciseEntriesTable.id, entryId)).limit(1);
  if (!entry) { res.status(404).json({ error: "Entrada não encontrada" }); return; }

  if (user.role === "patient") {
    const pid = await getPatientIdForUser(user.id);
    if (pid !== entry.patientId) { res.status(403).json({ error: "Acesso negado" }); return; }
  } else {
    const access = await ensurePatientAccess(user, entry.patientId, authResult.clinicId);
    if (!access) { res.status(403).json({ error: "Acesso negado" }); return; }
  }

  const estimate = await estimateCalories(entry.description);
  if (estimate != null) {
    await db.update(exerciseEntriesTable).set({ calorieEstimate: estimate }).where(eq(exerciseEntriesTable.id, entryId));
  }

  const [updated] = await db.select().from(exerciseEntriesTable).where(eq(exerciseEntriesTable.id, entryId)).limit(1);
  res.json({ ...updated!, createdAt: updated!.createdAt.toISOString() });
});

export default router;
