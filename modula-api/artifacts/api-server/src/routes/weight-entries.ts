import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, weightEntriesTable, patientsTable } from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess } from "../lib/auth-helpers";
import { CreateWeightEntryBody, UpdateWeightEntryBody } from "@workspace/api-zod";

const router = Router();

router.get("/weight-entries", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 52;

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

  const conditions = effectivePatientId ? [eq(weightEntriesTable.patientId, effectivePatientId)] : [];

  const rows = await db
    .select()
    .from(weightEntriesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(weightEntriesTable.date))
    .limit(limit);

  res.json(rows.map((r) => ({
    ...r,
    weightKg: Number(r.weightKg),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/weight-entries", async (req, res): Promise<void> => {
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
    res.status(403).json({ error: "Only patients can record weight entries" });
    return;
  }

  const parsed = CreateWeightEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, weightKg, note, photoUrl } = parsed.data;
  const dateStr = date instanceof Date ? date.toISOString().split("T")[0] : String(date);

  // Only one weight entry per patient per day.
  const sameDay = await db
    .select()
    .from(weightEntriesTable)
    .where(and(eq(weightEntriesTable.patientId, patientId), eq(weightEntriesTable.date, dateStr)))
    .limit(1);
  if (sameDay.length > 0) {
    res.status(409).json({ error: "Você já registrou seu peso hoje. É permitido apenas um registro por dia." });
    return;
  }

  const inserted = await db
    .insert(weightEntriesTable)
    .values({ patientId, date: dateStr, weightKg: String(weightKg), note: note ?? null, photoUrl: photoUrl ?? null })
    .returning();

  res.status(201).json({ ...inserted[0], weightKg: Number(inserted[0].weightKg), createdAt: inserted[0].createdAt.toISOString() });
});

router.get("/weight-entries/:entryId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.entryId) ? req.params.entryId[0] : req.params.entryId;
  const id = parseInt(raw, 10);

  const row = await db.select().from(weightEntriesTable).where(eq(weightEntriesTable.id, id)).limit(1);
  if (row.length === 0) {
    res.status(404).json({ error: "Weight entry not found" });
    return;
  }

  const { user } = authResult;
  if (user.role !== "patient") {
    const access = await ensurePatientAccess(user, row[0].patientId, authResult.clinicId);
    if (!access) { res.status(403).json({ error: "Acesso negado" }); return; }
  } else {
    const p = await db.select({ id: patientsTable.id }).from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    if (!p[0] || p[0].id !== row[0].patientId) { res.status(403).json({ error: "Acesso negado" }); return; }
  }

  res.json({ ...row[0], weightKg: Number(row[0].weightKg), createdAt: row[0].createdAt.toISOString() });
});

router.patch("/weight-entries/:entryId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;

  if (user.role !== "patient") {
    res.status(403).json({ error: "Only patients can edit their weight entries" });
    return;
  }

  const raw = Array.isArray(req.params.entryId) ? req.params.entryId[0] : req.params.entryId;
  const id = parseInt(raw, 10);

  const row = await db.select().from(weightEntriesTable).where(eq(weightEntriesTable.id, id)).limit(1);
  if (row.length === 0) {
    res.status(404).json({ error: "Weight entry not found" });
    return;
  }

  const p = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
  if (p.length === 0 || p[0].id !== row[0].patientId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateWeightEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.weightKg !== undefined) updates.weightKg = String(parsed.data.weightKg);
  if (parsed.data.note !== undefined) updates.note = parsed.data.note;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const updated = await db
    .update(weightEntriesTable)
    .set(updates)
    .where(eq(weightEntriesTable.id, id))
    .returning();

  res.json({ ...updated[0], weightKg: Number(updated[0].weightKg), createdAt: updated[0].createdAt.toISOString() });
});

export default router;
