import { Router } from "express";
import { eq, count, sql, and } from "drizzle-orm";
import {
  db,
  clinicsTable,
  clinicSettingsTable,
  clinicOwnersTable,
  usersTable,
  patientsTable,
  doctorsTable,
  patientClinicsTable,
  PLAN_DOCTOR_LIMITS,
} from "@workspace/db";
import { requireAuth, isError } from "../lib/auth-helpers";
import { z } from "zod/v4";

const router = Router();

function requireSuperAdmin(role: string, res: import("express").Response): boolean {
  if (role !== "super_admin") {
    res.status(403).json({ error: "Acesso restrito a super administradores." });
    return false;
  }
  return true;
}

// ── GET /admin/clinics ────────────────────────────────────────────────────────
router.get("/admin/clinics", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinics = await db
    .select({
      id: clinicsTable.id,
      name: clinicsTable.name,
      logoUrl: clinicsTable.logoUrl,
      primaryColor: clinicsTable.primaryColor,
      createdAt: clinicsTable.createdAt,
      plan: clinicSettingsTable.plan,
      clinicName: clinicSettingsTable.clinicName,
    })
    .from(clinicsTable)
    .leftJoin(clinicSettingsTable, eq(clinicSettingsTable.clinicId, clinicsTable.id))
    .orderBy(clinicsTable.name);

  // Count doctors and patients per clinic
  const doctorCounts = await db
    .select({ clinicId: doctorsTable.clinicId, cnt: count() })
    .from(doctorsTable)
    .groupBy(doctorsTable.clinicId);

  const patientCounts = await db
    .select({ clinicId: patientClinicsTable.clinicId, cnt: count() })
    .from(patientClinicsTable)
    .groupBy(patientClinicsTable.clinicId);

  const dcMap = new Map(doctorCounts.map((r) => [r.clinicId, r.cnt]));
  const pcMap = new Map(patientCounts.map((r) => [r.clinicId, r.cnt]));

  const result = clinics.map((c) => {
    const plan = c.plan ?? "basic";
    const doctorCount = dcMap.get(c.id) ?? 0;
    const limit = PLAN_DOCTOR_LIMITS[plan] ?? 2;
    const doctorLimit = isFinite(limit) ? limit : null;
    const planUsagePct = doctorLimit ? doctorCount / doctorLimit : null;
    return {
      id: c.id,
      name: c.clinicName ?? c.name,
      rawName: c.name,
      logoUrl: c.logoUrl,
      primaryColor: c.primaryColor,
      plan,
      doctorCount,
      patientCount: pcMap.get(c.id) ?? 0,
      doctorLimit,
      planUsagePct,
      isNearPlanLimit: planUsagePct != null && planUsagePct >= 0.9,
      createdAt: c.createdAt,
    };
  });

  res.json(result);
});

// ── POST /admin/clinics ───────────────────────────────────────────────────────
const createClinicSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  plan: z.enum(["basic", "pro", "professional", "enterprise"]).optional(),
});

router.post("/admin/clinics", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const parsed = createClinicSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos.", details: parsed.error.issues }); return; }

  const { name, logoUrl, primaryColor, plan } = parsed.data;

  const [clinic] = await db.insert(clinicsTable).values({
    name,
    logoUrl: logoUrl ?? null,
    primaryColor: primaryColor ?? "#16a34a",
  }).returning();

  await db.insert(clinicSettingsTable).values({
    clinicId: clinic.id,
    plan: plan ?? "basic",
    clinicName: name,
  });

  res.status(201).json(clinic);
});

// ── GET /admin/clinics/:id ────────────────────────────────────────────────────
router.get("/admin/clinics/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  if (isNaN(clinicId)) { res.status(400).json({ error: "ID inválido." }); return; }

  const [clinic] = await db
    .select({
      id: clinicsTable.id,
      name: clinicsTable.name,
      logoUrl: clinicsTable.logoUrl,
      primaryColor: clinicsTable.primaryColor,
      createdAt: clinicsTable.createdAt,
      plan: clinicSettingsTable.plan,
      clinicName: clinicSettingsTable.clinicName,
    })
    .from(clinicsTable)
    .leftJoin(clinicSettingsTable, eq(clinicSettingsTable.clinicId, clinicsTable.id))
    .where(eq(clinicsTable.id, clinicId))
    .limit(1);

  if (!clinic) { res.status(404).json({ error: "Clínica não encontrada." }); return; }

  const [doctorCountRow] = await db
    .select({ cnt: count() })
    .from(doctorsTable)
    .where(eq(doctorsTable.clinicId, clinicId));
  const doctorCount = doctorCountRow?.cnt ?? 0;
  const plan = clinic.plan ?? "basic";
  const limit = PLAN_DOCTOR_LIMITS[plan] ?? 2;
  const doctorLimit = isFinite(limit) ? limit : null;
  const planUsagePct = doctorLimit ? doctorCount / doctorLimit : null;

  res.json({
    id: clinic.id,
    name: clinic.clinicName ?? clinic.name,
    rawName: clinic.name,
    logoUrl: clinic.logoUrl,
    primaryColor: clinic.primaryColor,
    plan,
    doctorCount,
    doctorLimit,
    planUsagePct,
    isNearPlanLimit: planUsagePct != null && planUsagePct >= 0.9,
    createdAt: clinic.createdAt,
  });
});

// ── PATCH /admin/clinics/:id ──────────────────────────────────────────────────
const updateClinicSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().optional(),
  plan: z.enum(["basic", "pro", "professional", "enterprise"]).optional(),
});

router.patch("/admin/clinics/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  if (isNaN(clinicId)) { res.status(400).json({ error: "ID inválido." }); return; }

  const parsed = updateClinicSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos." }); return; }

  const { name, logoUrl, primaryColor, plan } = parsed.data;

  if (name !== undefined || logoUrl !== undefined || primaryColor !== undefined) {
    await db.update(clinicsTable).set({
      ...(name !== undefined && { name }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(primaryColor !== undefined && { primaryColor }),
    }).where(eq(clinicsTable.id, clinicId));
  }

  if (plan !== undefined || name !== undefined) {
    await db
      .insert(clinicSettingsTable)
      .values({ clinicId, plan: plan ?? "basic", clinicName: name ?? null })
      .onConflictDoUpdate({
        target: [clinicSettingsTable.clinicId],
        set: {
          ...(plan !== undefined && { plan, lastPlanLimitAlert: null }),
          ...(name !== undefined && { clinicName: name }),
        },
      });
  }

  const [updated] = await db
    .select({
      id: clinicsTable.id,
      name: clinicsTable.name,
      logoUrl: clinicsTable.logoUrl,
      primaryColor: clinicsTable.primaryColor,
      createdAt: clinicsTable.createdAt,
      plan: clinicSettingsTable.plan,
      clinicName: clinicSettingsTable.clinicName,
    })
    .from(clinicsTable)
    .leftJoin(clinicSettingsTable, eq(clinicSettingsTable.clinicId, clinicsTable.id))
    .where(eq(clinicsTable.id, clinicId))
    .limit(1);

  res.json({
    id: updated.id,
    name: updated.clinicName ?? updated.name,
    rawName: updated.name,
    logoUrl: updated.logoUrl,
    primaryColor: updated.primaryColor,
    plan: updated.plan ?? "basic",
    createdAt: updated.createdAt,
  });
});

// ── GET /admin/clinics/:id/owners ─────────────────────────────────────────────
router.get("/admin/clinics/:id/owners", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  if (isNaN(clinicId)) { res.status(400).json({ error: "ID inválido." }); return; }

  const owners = await db
    .select({
      userId: clinicOwnersTable.userId,
      clinicId: clinicOwnersTable.clinicId,
      createdAt: clinicOwnersTable.createdAt,
      name: usersTable.name,
      email: usersTable.email,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(clinicOwnersTable)
    .innerJoin(usersTable, eq(clinicOwnersTable.userId, usersTable.id))
    .where(eq(clinicOwnersTable.clinicId, clinicId));

  res.json(owners);
});

// ── POST /admin/clinics/:id/owners ────────────────────────────────────────────
const assignOwnerSchema = z.object({
  email: z.string().email(),
});

router.post("/admin/clinics/:id/owners", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  if (isNaN(clinicId)) { res.status(400).json({ error: "ID inválido." }); return; }

  const parsed = assignOwnerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "E-mail inválido." }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
  if (!user) { res.status(404).json({ error: "Usuário não encontrado." }); return; }

  // Check if clinic exists
  const [clinic] = await db.select({ id: clinicsTable.id }).from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1);
  if (!clinic) { res.status(404).json({ error: "Clínica não encontrada." }); return; }

  // Upsert owner role
  await db.update(usersTable).set({ role: "clinic_owner" }).where(eq(usersTable.id, user.id));

  await db
    .insert(clinicOwnersTable)
    .values({ userId: user.id, clinicId })
    .onConflictDoNothing();

  res.status(201).json({ userId: user.id, clinicId, name: user.name, email: user.email });
});

// ── DELETE /admin/clinics/:id/owners/:userId ──────────────────────────────────
router.delete("/admin/clinics/:id/owners/:userId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(clinicId) || isNaN(userId)) { res.status(400).json({ error: "ID inválido." }); return; }

  await db.delete(clinicOwnersTable).where(
    and(eq(clinicOwnersTable.clinicId, clinicId), eq(clinicOwnersTable.userId, userId))
  );

  res.json({ success: true });
});

// ── GET /admin/clinics/:id/patients ──────────────────────────────────────────
router.get("/admin/clinics/:id/patients", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  if (isNaN(clinicId)) { res.status(400).json({ error: "ID inválido." }); return; }

  const patients = await db
    .select({
      patientId: patientsTable.id,
      userId: patientsTable.userId,
      enrolledAt: patientClinicsTable.enrolledAt,
      name: usersTable.name,
      email: usersTable.email,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(patientClinicsTable)
    .innerJoin(patientsTable, eq(patientClinicsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(patientsTable.userId, usersTable.id))
    .where(eq(patientClinicsTable.clinicId, clinicId))
    .orderBy(usersTable.name);

  res.json(patients);
});

// ── POST /admin/clinics/:id/patients (enroll by email) ───────────────────────
const enrollPatientSchema = z.object({
  email: z.string().email(),
});

router.post("/admin/clinics/:id/patients", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  if (isNaN(clinicId)) { res.status(400).json({ error: "ID inválido." }); return; }

  const parsed = enrollPatientSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "E-mail inválido." }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
  if (!user) { res.status(404).json({ error: "Usuário não encontrado." }); return; }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado. O usuário existe mas não é um paciente." }); return; }

  const [clinic] = await db.select({ id: clinicsTable.id }).from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1);
  if (!clinic) { res.status(404).json({ error: "Clínica não encontrada." }); return; }

  await db
    .insert(patientClinicsTable)
    .values({ patientId: patient.id, clinicId })
    .onConflictDoNothing();

  res.status(201).json({ patientId: patient.id, clinicId, name: user.name, email: user.email });
});

// ── DELETE /admin/clinics/:id/patients/:patientId ────────────────────────────
router.delete("/admin/clinics/:id/patients/:patientId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  const patientId = parseInt(req.params.patientId, 10);
  if (isNaN(clinicId) || isNaN(patientId)) { res.status(400).json({ error: "ID inválido." }); return; }

  await db.delete(patientClinicsTable).where(
    and(eq(patientClinicsTable.clinicId, clinicId), eq(patientClinicsTable.patientId, patientId))
  );

  res.json({ success: true });
});

// ── GET /admin/clinics/:id/doctors ───────────────────────────────────────────
router.get("/admin/clinics/:id/doctors", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) { res.status(authResult.status).json({ error: authResult.error }); return; }
  if (!requireSuperAdmin(authResult.user.role, res)) return;

  const clinicId = parseInt(req.params.id, 10);
  if (isNaN(clinicId)) { res.status(400).json({ error: "ID inválido." }); return; }

  const doctors = await db
    .select({
      doctorId: doctorsTable.id,
      userId: doctorsTable.userId,
      specialty: doctorsTable.specialty,
      createdAt: doctorsTable.createdAt,
      name: usersTable.name,
      email: usersTable.email,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
    .where(eq(doctorsTable.clinicId, clinicId))
    .orderBy(usersTable.name);

  res.json(doctors);
});

export default router;
