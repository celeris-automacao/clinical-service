import { Router } from "express";
import { db } from "@workspace/db";
import {
  patientMaterialsTable,
  patientsTable,
  usersTable,
  patientDoctorsTable,
  doctorsTable,
  insertPatientMaterialSchema,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, isError, ensurePatientAccess } from "../lib/auth-helpers";
import { z } from "zod/v4";

const router = Router();

// ─── List materials for a patient ────────────────────────────────────────────
router.get("/patients/:patientId/materials", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  const patientId = Number(req.params.patientId);

  // Verify role-based and clinic-enrollment access for all roles
  const allowed = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const rows = await db
    .select({
      id: patientMaterialsTable.id,
      patientId: patientMaterialsTable.patientId,
      senderId: patientMaterialsTable.senderId,
      type: patientMaterialsTable.type,
      title: patientMaterialsTable.title,
      description: patientMaterialsTable.description,
      fileUrl: patientMaterialsTable.fileUrl,
      externalUrl: patientMaterialsTable.externalUrl,
      createdAt: patientMaterialsTable.createdAt,
      senderName: usersTable.name,
      senderRole: usersTable.role,
    })
    .from(patientMaterialsTable)
    .leftJoin(usersTable, eq(usersTable.id, patientMaterialsTable.senderId))
    .where(eq(patientMaterialsTable.patientId, patientId))
    .orderBy(desc(patientMaterialsTable.createdAt));

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// ─── Create material ──────────────────────────────────────────────────────────
const createSchema = insertPatientMaterialSchema.omit({ senderId: true, patientId: true });

router.post("/patients/:patientId/materials", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role === "patient") {
    res.status(403).json({ error: "Pacientes não podem enviar materiais" });
    return;
  }

  const patientId = Number(req.params.patientId);

  // Verify role-based and clinic-enrollment access for all roles
  const allowed = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.prettifyError(parsed.error) });
    return;
  }

  const [row] = await db
    .insert(patientMaterialsTable)
    .values({
      patientId,
      senderId: user.id,
      ...parsed.data,
    })
    .returning();

  const [sender] = await db
    .select({ name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1);

  res.status(201).json({
    ...row,
    createdAt: row!.createdAt.toISOString(),
    senderName: sender?.name ?? null,
    senderRole: sender?.role ?? null,
  });
});

// ─── Delete material ──────────────────────────────────────────────────────────
router.delete("/materials/:materialId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role === "patient") {
    res.status(403).json({ error: "Pacientes não podem excluir materiais" });
    return;
  }

  const materialId = Number(req.params.materialId);
  const [mat] = await db
    .select()
    .from(patientMaterialsTable)
    .where(eq(patientMaterialsTable.id, materialId))
    .limit(1);
  if (!mat) { res.status(404).json({ error: "Material não encontrado" }); return; }

  if (user.role === "profissional_saude" && mat.senderId !== user.id) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  await db.delete(patientMaterialsTable).where(eq(patientMaterialsTable.id, materialId));
  res.status(204).end();
});

export default router;
