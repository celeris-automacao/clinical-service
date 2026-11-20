import { Router } from "express";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { db, calorieEntriesTable, patientsTable } from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess } from "../lib/auth-helpers";
import { maybeAwardXp } from "../lib/xp-helpers";
import { z } from "zod/v4";

const router = Router();

const createSchema = z.object({
  patientId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealLabel: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]).optional(),
  photoUrl: z.string().optional(),
  calories: z.number().int().min(0).max(10000),
  aiDescription: z.string().optional(),
  proteinG: z.number().int().min(0).optional(),
  carbG: z.number().int().min(0).optional(),
  fatG: z.number().int().min(0).optional(),
});

async function getPatientIdForUser(userId: number): Promise<number | null> {
  const [p] = await db.select({ id: patientsTable.id }).from(patientsTable).where(eq(patientsTable.userId, userId)).limit(1);
  return p?.id ?? null;
}

// ─── GET /calorie-entries ──────────────────────────────────────────────────────
router.get("/calorie-entries", async (req, res): Promise<void> => {
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

  const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;

  const conditions = [eq(calorieEntriesTable.patientId, patientId)];
  if (dateFrom) conditions.push(gte(calorieEntriesTable.date, dateFrom));
  if (dateTo) conditions.push(lte(calorieEntriesTable.date, dateTo));

  const rows = await db
    .select()
    .from(calorieEntriesTable)
    .where(and(...conditions))
    .orderBy(desc(calorieEntriesTable.createdAt));

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// ─── POST /calorie-entries ─────────────────────────────────────────────────────
router.post("/calorie-entries", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.prettifyError(parsed.error) }); return; }

  const { user } = authResult;
  let patientId = parsed.data.patientId;

  if (user.role === "patient") {
    const pid = await getPatientIdForUser(user.id);
    if (pid !== patientId) { res.status(403).json({ error: "Acesso negado" }); return; }
  } else {
    const access = await ensurePatientAccess(user, patientId, authResult.clinicId);
    if (!access) { res.status(403).json({ error: "Acesso negado" }); return; }
  }

  const [row] = await db.insert(calorieEntriesTable).values(parsed.data).returning();

  // Award XP for first meal entry of the day (also evaluates weekly bonus)
  await maybeAwardXp(patientId, parsed.data.date, "nutrition");

  res.status(201).json({ ...row, createdAt: row!.createdAt.toISOString() });
});

// ─── DELETE /calorie-entries/:id ───────────────────────────────────────────────
router.delete("/calorie-entries/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;

  const entryId = Number(req.params.id);
  const [entry] = await db.select().from(calorieEntriesTable).where(eq(calorieEntriesTable.id, entryId)).limit(1);
  if (!entry) { res.status(404).json({ error: "Entrada não encontrada" }); return; }

  if (user.role === "patient") {
    const pid = await getPatientIdForUser(user.id);
    if (pid !== entry.patientId) { res.status(403).json({ error: "Acesso negado" }); return; }
  } else {
    const access = await ensurePatientAccess(user, entry.patientId, authResult.clinicId);
    if (!access) { res.status(403).json({ error: "Acesso negado" }); return; }
  }

  await db.delete(calorieEntriesTable).where(eq(calorieEntriesTable.id, entryId));
  res.status(204).end();
});

// ─── GET /calorie-entries/summary ─────────────────────────────────────────────
router.get("/calorie-entries/summary", async (req, res): Promise<void> => {
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

  const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;
  const conditions = [eq(calorieEntriesTable.patientId, patientId)];
  if (dateFrom) conditions.push(gte(calorieEntriesTable.date, dateFrom));
  if (dateTo) conditions.push(lte(calorieEntriesTable.date, dateTo));

  const rows = await db
    .select({
      date: calorieEntriesTable.date,
      total: sql<number>`sum(${calorieEntriesTable.calories})`,
    })
    .from(calorieEntriesTable)
    .where(and(...conditions))
    .groupBy(calorieEntriesTable.date)
    .orderBy(calorieEntriesTable.date);

  res.json(rows.map((r) => ({ date: r.date, total: Number(r.total) })));
});

export default router;
