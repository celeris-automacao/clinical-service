import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, patientNotesTable, usersTable, patientsTable, staffEventsTable } from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess, resolveCallerClinicId } from "../lib/auth-helpers";
import { CreatePatientNoteBody, UpdatePatientNoteBody } from "@workspace/api-zod";

const router = Router();

const STAFF_ROLES = new Set(["clinic_owner", "profissional_saude", "secretaria"]);

async function buildNoteResponse(note: typeof patientNotesTable.$inferSelect) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, note.authorUserId)).limit(1);
  return {
    id: note.id,
    patientId: note.patientId,
    authorUserId: note.authorUserId,
    authorRole: note.authorRole,
    authorName: author?.name ?? "",
    text: note.text,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

router.get("/patient-notes", async (req, res): Promise<void> => {
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

  const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
  if (!patientId) {
    res.status(400).json({ error: "patientId obrigatório" });
    return;
  }

  const allowed = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const rows = await db
    .select()
    .from(patientNotesTable)
    .where(eq(patientNotesTable.patientId, patientId))
    .orderBy(desc(patientNotesTable.createdAt));

  res.json(await Promise.all(rows.map(buildNoteResponse)));
});

router.post("/patient-notes", async (req, res): Promise<void> => {
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

  const parsed = CreatePatientNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { patientId, text } = parsed.data;

  const allowed = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const [inserted] = await db
    .insert(patientNotesTable)
    .values({ patientId, authorUserId: user.id, authorRole: user.role, text })
    .returning();

  const [patientUser] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .innerJoin(patientsTable, eq(patientsTable.userId, usersTable.id))
    .where(eq(patientsTable.id, patientId))
    .limit(1);

  await db.insert(staffEventsTable).values({
    userId: user.id,
    clinicId: await resolveCallerClinicId(user, authResult.clinicId),
    type: "patient_note",
    description: `${user.name} adicionou uma nota no CRM de ${patientUser?.name ?? "paciente"}.`,
  });

  res.status(201).json(await buildNoteResponse(inserted));
});

router.patch("/patient-notes/:noteId", async (req, res): Promise<void> => {
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

  const noteId = Number(req.params.noteId);
  const [note] = await db.select().from(patientNotesTable).where(eq(patientNotesTable.id, noteId)).limit(1);
  if (!note) {
    res.status(404).json({ error: "Nota não encontrada" });
    return;
  }

  const allowed = await ensurePatientAccess(user, note.patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const parsed = UpdatePatientNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(patientNotesTable)
    .set({ text: parsed.data.text, updatedAt: new Date() })
    .where(eq(patientNotesTable.id, noteId))
    .returning();

  await db.insert(staffEventsTable).values({
    userId: user.id,
    clinicId: await resolveCallerClinicId(user, authResult.clinicId),
    type: "patient_note",
    description: `${user.name} editou uma nota no CRM.`,
  });

  res.json(await buildNoteResponse(updated));
});

router.delete("/patient-notes/:noteId", async (req, res): Promise<void> => {
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

  const noteId = Number(req.params.noteId);
  const [note] = await db.select().from(patientNotesTable).where(eq(patientNotesTable.id, noteId)).limit(1);
  if (!note) {
    res.status(404).json({ error: "Nota não encontrada" });
    return;
  }

  const allowed = await ensurePatientAccess(user, note.patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  await db.delete(patientNotesTable).where(eq(patientNotesTable.id, noteId));

  await db.insert(staffEventsTable).values({
    userId: user.id,
    clinicId: await resolveCallerClinicId(user, authResult.clinicId),
    type: "patient_note",
    description: `${user.name} apagou uma nota no CRM.`,
  });

  res.status(204).send();
});

export default router;
