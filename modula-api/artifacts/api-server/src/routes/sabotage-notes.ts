import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, sabotageNotesTable, patientsTable } from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess } from "../lib/auth-helpers";
import { CreateSabotageNoteBody } from "@workspace/api-zod";

const router = Router();

router.get("/sabotage-notes", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  let effectivePatientId = patientId;
  if (user.role === "patient" && !patientId) {
    const p = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    effectivePatientId = p[0]?.id;
  } else if (user.role !== "patient") {
    if (!effectivePatientId) {
      res.status(400).json({ error: "patientId obrigatório" });
      return;
    }
    const allowed = await ensurePatientAccess(user, effectivePatientId, authResult.clinicId);
    if (!allowed) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
  }

  const conditions = effectivePatientId ? [eq(sabotageNotesTable.patientId, effectivePatientId)] : [];

  const rows = await db
    .select()
    .from(sabotageNotesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sabotageNotesTable.date))
    .limit(limit);

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/sabotage-notes", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;

  let patientId: number;
  if (user.role === "patient") {
    const p = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    if (p.length === 0) {
      res.status(404).json({ error: "Patient record not found" });
      return;
    }
    patientId = p[0].id;
  } else {
    res.status(403).json({ error: "Only patients can add sabotage notes" });
    return;
  }

  const parsed = CreateSabotageNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, reason, whatHappened } = parsed.data;
  const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : String(date);

  const inserted = await db
    .insert(sabotageNotesTable)
    .values({ patientId, date: dateStr, reason, whatHappened: whatHappened ?? null })
    .returning();

  res.status(201).json({ ...inserted[0], createdAt: inserted[0].createdAt.toISOString() });
});

export default router;
