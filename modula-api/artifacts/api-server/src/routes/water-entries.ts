import { Router } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, waterEntriesTable, patientsTable } from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess } from "../lib/auth-helpers";
import { maybeAwardXp } from "../lib/xp-helpers";
import { z } from "zod/v4";

const router = Router();

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountMl: z.number().int().min(1).max(5000),
});

async function getPatientIdForUser(userId: number): Promise<number | null> {
  const [p] = await db.select({ id: patientsTable.id }).from(patientsTable).where(eq(patientsTable.userId, userId)).limit(1);
  return p?.id ?? null;
}

router.get("/water-entries", async (req, res): Promise<void> => {
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

  const conditions = [eq(waterEntriesTable.patientId, patientId)];
  if (effectiveFrom) conditions.push(gte(waterEntriesTable.date, effectiveFrom));
  if (effectiveTo) conditions.push(lte(waterEntriesTable.date, effectiveTo));

  const rows = await db
    .select()
    .from(waterEntriesTable)
    .where(and(...conditions))
    .orderBy(desc(waterEntriesTable.createdAt));

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/water-entries", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }

  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem registrar água" });
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.prettifyError(parsed.error) }); return; }

  const patientId = await getPatientIdForUser(authResult.user.id);
  if (!patientId) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  const [row] = await db
    .insert(waterEntriesTable)
    .values({ patientId, date: parsed.data.date, amountMl: parsed.data.amountMl })
    .returning();

  // Award XP for first water entry of the day (also evaluates weekly bonus)
  await maybeAwardXp(patientId, parsed.data.date, "water");

  res.status(201).json({ ...row!, createdAt: row!.createdAt.toISOString() });
});

router.delete("/water-entries/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  const { user } = authResult;

  const entryId = Number(req.params.id);
  const [entry] = await db.select().from(waterEntriesTable).where(eq(waterEntriesTable.id, entryId)).limit(1);
  if (!entry) { res.status(404).json({ error: "Entrada não encontrada" }); return; }

  if (user.role === "patient") {
    const pid = await getPatientIdForUser(user.id);
    if (pid !== entry.patientId) { res.status(403).json({ error: "Acesso negado" }); return; }
  } else {
    const access = await ensurePatientAccess(user, entry.patientId, authResult.clinicId);
    if (!access) { res.status(403).json({ error: "Acesso negado" }); return; }
  }

  await db.delete(waterEntriesTable).where(eq(waterEntriesTable.id, entryId));
  res.status(204).end();
});

export default router;
