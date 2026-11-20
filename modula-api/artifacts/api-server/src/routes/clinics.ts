import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, clinicsTable, clinicOwnersTable, patientClinicsTable, patientsTable } from "@workspace/db";
import { requireAuth, isError } from "../lib/auth-helpers";

const router = Router();

const clinicShape = (c: typeof clinicsTable.$inferSelect) => ({
  id: c.id,
  name: c.name,
  logoUrl: c.logoUrl ?? null,
  primaryColor: c.primaryColor ?? null,
});

router.get("/clinics/my-clinics", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role === "clinic_owner") {
    const clinics = await db
      .select({
        id: clinicsTable.id,
        name: clinicsTable.name,
        logoUrl: clinicsTable.logoUrl,
        primaryColor: clinicsTable.primaryColor,
      })
      .from(clinicOwnersTable)
      .innerJoin(clinicsTable, eq(clinicOwnersTable.clinicId, clinicsTable.id))
      .where(eq(clinicOwnersTable.userId, user.id))
      .orderBy(clinicsTable.name);
    res.json(clinics);
    return;
  }

  if (user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes e clinic owners podem listar clínicas." });
    return;
  }

  const [patient] = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(eq(patientsTable.userId, user.id))
    .limit(1);

  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado." });
    return;
  }

  const clinics = await db
    .select({
      id: clinicsTable.id,
      name: clinicsTable.name,
      logoUrl: clinicsTable.logoUrl,
      primaryColor: clinicsTable.primaryColor,
    })
    .from(patientClinicsTable)
    .innerJoin(clinicsTable, eq(patientClinicsTable.clinicId, clinicsTable.id))
    .where(eq(patientClinicsTable.patientId, patient.id))
    .orderBy(clinicsTable.name);

  res.json(clinics);
});

// ─── POST /clinics ─────────────────────────────────────────────────────────
router.post("/clinics", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas proprietários de clínica podem criar clínicas." });
    return;
  }

  const parsed = z.object({
    name: z.string().trim().min(1, "Nome obrigatório"),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    logoUrl: z.string().startsWith("/objects/").optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const [clinic] = await db
    .insert(clinicsTable)
    .values({
      name: parsed.data.name,
      primaryColor: parsed.data.primaryColor ?? "#16a34a",
      logoUrl: parsed.data.logoUrl,
    })
    .returning();

  await db.insert(clinicOwnersTable).values({
    userId: authResult.user.id,
    clinicId: clinic!.id,
  });

  res.status(201).json(clinicShape(clinic!));
});

// ─── PATCH /clinics/:id ────────────────────────────────────────────────────
router.patch("/clinics/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas proprietários de clínica podem editar clínicas." });
    return;
  }

  const clinicId = Number(req.params.id);
  if (!Number.isInteger(clinicId) || clinicId <= 0) {
    res.status(400).json({ error: "ID de clínica inválido." });
    return;
  }

  const [ownership] = await db
    .select({ clinicId: clinicOwnersTable.clinicId })
    .from(clinicOwnersTable)
    .where(and(eq(clinicOwnersTable.userId, authResult.user.id), eq(clinicOwnersTable.clinicId, clinicId)))
    .limit(1);

  if (!ownership) {
    res.status(403).json({ error: "Você não tem permissão para editar esta clínica." });
    return;
  }

  const parsed = z.object({
    name: z.string().trim().min(1).optional(),
    logoUrl: z.string().startsWith("/objects/").nullable().optional(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const updateData: Partial<typeof clinicsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.logoUrl !== undefined) updateData.logoUrl = parsed.data.logoUrl;
  if (parsed.data.primaryColor !== undefined) updateData.primaryColor = parsed.data.primaryColor;

  const [updated] = await db
    .update(clinicsTable)
    .set(updateData)
    .where(eq(clinicsTable.id, clinicId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Clínica não encontrada." });
    return;
  }

  res.json(clinicShape(updated));
});

export default router;
