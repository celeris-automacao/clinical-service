import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, secretariesTable, doctorsTable } from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId, resolveSecretaryClinicId } from "../lib/auth-helpers";
import { hashPassword } from "../lib/jwt";
import { CreateSecretaryBody, UpdateSecretaryBody } from "@workspace/api-zod";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const router = Router();

async function buildSecretaryResponse(secretary: typeof secretariesTable.$inferSelect) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, secretary.userId)).limit(1);
  return {
    id: secretary.id,
    userId: secretary.userId,
    name: user[0]?.name ?? "",
    email: user[0]?.email ?? "",
    avatarUrl: user[0]?.avatarUrl ?? null,
    phone: secretary.phone ?? null,
    cpf: secretary.cpf ?? null,
    rg: secretary.rg ?? null,
    birthDate: secretary.birthDate ?? null,
    salary: secretary.salary != null ? Number(secretary.salary) : null,
    createdAt: secretary.createdAt.toISOString(),
    status: user[0]?.deactivatedAt ? ("inactive" as const) : ("active" as const),
  };
}

// Resolve the caller's effective clinic across all staff roles that may
// legitimately view the secretaries list (owner, doctors, and secretaries
// themselves). Returns null if the caller has no clinic linked.
async function resolveCallerClinicIdForSecretaries(
  user: { id: number; role: string },
  jwtClinicId?: number
): Promise<number | null> {
  if (user.role === "clinic_owner") {
    return (await resolveOwnerClinicId(user.id, jwtClinicId)) ?? null;
  }
  if (user.role === "profissional_saude") {
    const [myDoc] = await db
      .select({ clinicId: doctorsTable.clinicId })
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    return myDoc?.clinicId ?? null;
  }
  if (user.role === "secretaria") {
    return (await resolveSecretaryClinicId(user.id, jwtClinicId)) ?? null;
  }
  return null;
}

router.get("/secretaries", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const clinicId = await resolveCallerClinicIdForSecretaries(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const secretaries = await db
    .select()
    .from(secretariesTable)
    .where(eq(secretariesTable.clinicId, clinicId));

  const results = await Promise.all(secretaries.map(buildSecretaryResponse));
  res.json(results);
});

router.post("/secretaries", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can add secretaries" });
    return;
  }

  const ownerClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (!ownerClinicId) {
    res.status(400).json({ error: "Administrador não tem clínica vinculada." });
    return;
  }

  const parsed = CreateSecretaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, avatarUrl, phone, cpf, rg, birthDate, salary } = parsed.data;

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const newUser = await db
    .insert(usersTable)
    .values({
      clerkId: `secretaria_${Date.now()}`,
      email,
      name,
      role: "secretaria",
      avatarUrl: avatarUrl ?? null,
      passwordHash,
      isTemporaryPassword: true,
    })
    .returning();

  const newSecretary = await db
    .insert(secretariesTable)
    .values({
      userId: newUser[0].id,
      clinicId: ownerClinicId,
      phone: phone ?? null,
      cpf: cpf ?? null,
      rg: rg ?? null,
      birthDate: birthDate != null ? (birthDate instanceof Date ? birthDate.toISOString().split("T")[0] : String(birthDate)) : null,
      salary: salary !== undefined ? salary.toString() : null,
    })
    .returning();

  const result = await buildSecretaryResponse(newSecretary[0]);
  res.status(201).json({ ...result, temporaryPassword: tempPassword });
});

router.patch("/secretaries/:secretaryId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can edit secretaries" });
    return;
  }

  const raw = Array.isArray(req.params.secretaryId) ? req.params.secretaryId[0] : req.params.secretaryId;
  const secretaryId = parseInt(raw, 10);

  const [secretary] = await db.select().from(secretariesTable).where(eq(secretariesTable.id, secretaryId)).limit(1);
  if (!secretary) {
    res.status(404).json({ error: "Secretary not found" });
    return;
  }

  const patchClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (patchClinicId === null) {
    res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
    return;
  }
  if (secretary.clinicId !== patchClinicId) {
    res.status(403).json({ error: "Esta secretária não pertence à sua clínica." });
    return;
  }

  const parsed = UpdateSecretaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, status, avatarUrl, phone, cpf, rg, birthDate, salary } = parsed.data;

  const userUpdates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) userUpdates.name = name;
  if (email !== undefined) userUpdates.email = email.toLowerCase();
  if (avatarUrl !== undefined) userUpdates.avatarUrl = avatarUrl;
  if (password !== undefined) {
    userUpdates.passwordHash = await hashPassword(password);
    userUpdates.isTemporaryPassword = false;
  }
  if (status === "active") {
    userUpdates.deactivatedAt = null;
  } else if (status === "inactive") {
    userUpdates.deactivatedAt = new Date();
  }

  await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, secretary.userId));

  const secretaryUpdates: Record<string, unknown> = {};
  if (phone !== undefined) secretaryUpdates.phone = phone;
  if (cpf !== undefined) secretaryUpdates.cpf = cpf;
  if (rg !== undefined) secretaryUpdates.rg = rg;
  if (birthDate !== undefined) secretaryUpdates.birthDate = birthDate != null ? (birthDate instanceof Date ? birthDate.toISOString().split("T")[0] : String(birthDate)) : null;
  if (salary !== undefined) secretaryUpdates.salary = salary != null ? salary.toString() : null;

  if (Object.keys(secretaryUpdates).length > 0) {
    await db.update(secretariesTable).set(secretaryUpdates).where(eq(secretariesTable.id, secretaryId));
  }

  const [updatedSecretary] = await db.select().from(secretariesTable).where(eq(secretariesTable.id, secretaryId)).limit(1);
  const result = await buildSecretaryResponse(updatedSecretary);
  res.json(result);
});

router.delete("/secretaries/:secretaryId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can remove secretaries" });
    return;
  }

  const raw = Array.isArray(req.params.secretaryId) ? req.params.secretaryId[0] : req.params.secretaryId;
  const secretaryId = parseInt(raw, 10);

  const [secretary] = await db.select().from(secretariesTable).where(eq(secretariesTable.id, secretaryId)).limit(1);
  if (!secretary) {
    res.status(404).json({ error: "Secretary not found" });
    return;
  }

  const deleteClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (deleteClinicId === null) {
    res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
    return;
  }
  if (secretary.clinicId !== deleteClinicId) {
    res.status(403).json({ error: "Esta secretária não pertence à sua clínica." });
    return;
  }

  await db.update(usersTable).set({ deactivatedAt: new Date() }).where(eq(usersTable.id, secretary.userId));

  res.status(204).send();
});

export default router;
