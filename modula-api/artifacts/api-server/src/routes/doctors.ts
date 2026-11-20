import { Router } from "express";
import { eq, sql, isNull, inArray, and, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  doctorsTable,
  doctorInsurancesTable,
  patientDoctorsTable,
  patientsTable,
  patientClinicsTable,
  clinicSettingsTable,
  clinicOwnersTable,
  appointmentReviewsTable,
  PLAN_DOCTOR_LIMITS,
} from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId, resolveSecretaryClinicId } from "../lib/auth-helpers";
import { hashPassword } from "../lib/jwt";
import { CreateDoctorBody, UpdateDoctorBody } from "@workspace/api-zod";
import { checkAndFirePlanLimitAlert, reconcilePlanLimitAlertOnDecrease } from "../lib/plan-limit-alerts";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const router = Router();

async function buildDoctorResponse(doctor: typeof doctorsTable.$inferSelect, viewerRole?: string) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, doctor.userId)).limit(1);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(patientDoctorsTable)
    .where(eq(patientDoctorsTable.doctorId, doctor.id));

  const [reviewStats] = await db
    .select({
      avgRating: sql<string | null>`avg(${appointmentReviewsTable.rating})`,
      reviewCount: sql<number>`count(*)`,
    })
    .from(appointmentReviewsTable)
    .where(eq(appointmentReviewsTable.doctorId, doctor.id));

  const insuranceRows = await db
    .select()
    .from(doctorInsurancesTable)
    .where(eq(doctorInsurancesTable.doctorId, doctor.id));

  return {
    id: doctor.id,
    userId: doctor.userId,
    name: user[0]?.name ?? "",
    email: user[0]?.email ?? "",
    avatarUrl: user[0]?.avatarUrl ?? null,
    specialty: doctor.specialty,
    bio: doctor.bio ?? null,
    showOnPublicPage: doctor.showOnPublicPage,
    patientCount: Number(countResult[0]?.count ?? 0),
    avgRating: reviewStats?.avgRating != null ? Math.round(Number(reviewStats.avgRating) * 10) / 10 : null,
    reviewCount: Number(reviewStats?.reviewCount ?? 0),
    consultationPrice: doctor.consultationPrice != null ? Number(doctor.consultationPrice) : null,
    acceptsInsurance: doctor.acceptsInsurance,
    commissionPercent: doctor.commissionPercent != null ? Number(doctor.commissionPercent) : null,
    insurances: insuranceRows.map((i) => ({ id: i.id, name: i.name, price: Number(i.price) })),
    phone: doctor.phone ?? null,
    cpf: doctor.cpf ?? null,
    rg: doctor.rg ?? null,
    birthDate: doctor.birthDate ?? null,
    // Salary is sensitive financial data — only expose to clinic owners.
    ...(viewerRole === "clinic_owner" ? { salary: doctor.salary != null ? Number(doctor.salary) : null } : {}),
    createdAt: doctor.createdAt.toISOString(),
  };
}

async function replaceDoctorInsurances(
  doctorId: number,
  insurances: { name: string; price: number }[]
): Promise<void> {
  await db.delete(doctorInsurancesTable).where(eq(doctorInsurancesTable.doctorId, doctorId));
  if (insurances.length > 0) {
    await db.insert(doctorInsurancesTable).values(
      insurances.map((i) => ({ doctorId, name: i.name, price: i.price.toString() }))
    );
  }
}

router.get("/doctors", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;

  const activeUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(isNull(usersTable.deactivatedAt));
  const activeUserIds = activeUsers.map((u) => u.id);

  if (activeUserIds.length === 0) {
    res.json([]);
    return;
  }

  // Resolve the effective clinic: owners use their clinic, staff use their own doctor record's clinic
  let clinicId: number | null = null;
  if (user.role === "clinic_owner") {
    const resolved = await resolveOwnerClinicId(user.id, authResult.clinicId);
    clinicId = resolved ?? null;
  } else if (user.role === "profissional_saude") {
    const [myDoc] = await db
      .select({ clinicId: doctorsTable.clinicId })
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    clinicId = myDoc?.clinicId ?? null;
  } else if (user.role === "secretaria") {
    clinicId = (await resolveSecretaryClinicId(user.id, authResult.clinicId)) ?? null;
  } else if (user.role === "patient") {
    const [patient] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, user.id))
      .limit(1);
    if (patient) {
      const [enrollment] = await db
        .select({ clinicId: patientClinicsTable.clinicId })
        .from(patientClinicsTable)
        .where(eq(patientClinicsTable.patientId, patient.id))
        .limit(1);
      clinicId = enrollment?.clinicId ?? null;
    }
  }

  // Always filter by clinic — fail closed if clinic can't be resolved
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }
  const doctors = await db
    .select()
    .from(doctorsTable)
    .where(and(inArray(doctorsTable.userId, activeUserIds), eq(doctorsTable.clinicId, clinicId)));

  const results = await Promise.all(doctors.map((d) => buildDoctorResponse(d, user.role)));
  res.json(results);
});

router.post("/doctors", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can add doctors" });
    return;
  }

  // ── Resolve the owner's clinic (required for doctor creation) ────────────
  const ownerClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (!ownerClinicId) {
    res.status(400).json({ error: "Administrador não tem clínica vinculada." });
    return;
  }

  // ── Enforce plan doctor limit (scoped to this clinic) ─────────────────────
  const [settingsRow] = await db
    .select()
    .from(clinicSettingsTable)
    .where(eq(clinicSettingsTable.clinicId, ownerClinicId))
    .limit(1);
  const plan = settingsRow?.plan ?? "basic";
  const limit = PLAN_DOCTOR_LIMITS[plan] ?? 2;
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(and(eq(doctorsTable.clinicId, ownerClinicId), isNull(usersTable.deactivatedAt)));
  const currentCount = Number(countRow?.count ?? 0);
  if (isFinite(limit) && currentCount >= limit) {
    res.status(403).json({
      error: `Limite de médicos atingido para o plano ${plan} (máximo ${limit}). Faça upgrade do plano para continuar.`,
      planLimitReached: true,
    });
    return;
  }

  const parsed = CreateDoctorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, specialty, bio, avatarUrl, consultationPrice, acceptsInsurance, insurances, showOnPublicPage, phone, cpf, rg, birthDate, salary } = parsed.data;

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const newUser = await db
    .insert(usersTable)
    .values({
      clerkId: `doctor_${Date.now()}`,
      email,
      name,
      role: "profissional_saude",
      avatarUrl: avatarUrl ?? null,
      passwordHash,
      isTemporaryPassword: true,
    })
    .returning();

  const newDoctor = await db
    .insert(doctorsTable)
    .values({
      userId: newUser[0].id,
      clinicId: ownerClinicId,
      specialty,
      bio: bio ?? null,
      consultationPrice: consultationPrice !== undefined ? consultationPrice.toString() : null,
      acceptsInsurance: acceptsInsurance ?? false,
      showOnPublicPage: showOnPublicPage ?? false,
      phone: phone ?? null,
      cpf: cpf ?? null,
      rg: rg ?? null,
      birthDate: birthDate != null ? (birthDate instanceof Date ? birthDate.toISOString().split("T")[0] : String(birthDate)) : null,
      salary: salary !== undefined ? salary.toString() : null,
    })
    .returning();

  if (insurances && insurances.length > 0) {
    await replaceDoctorInsurances(newDoctor[0].id, insurances);
  }

  await checkAndFirePlanLimitAlert(ownerClinicId, currentCount + 1);

  const result = await buildDoctorResponse(newDoctor[0], authResult.user.role);
  res.status(201).json({ ...result, temporaryPassword: tempPassword });
});

router.patch("/doctors/:doctorId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const raw = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const doctorId = parseInt(raw, 10);

  const doctor = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (doctor.length === 0) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  // Only the clinic owner (of this doctor's clinic) or the doctor themself may
  // edit this record. Self-edits are restricted to bio/price/insurance fields
  // further below — name/specialty/avatarUrl remain owner-only.
  const isSelf = authResult.user.role === "profissional_saude" && doctor[0].userId === authResult.user.id;
  let isOwnerOfClinic = false;
  if (authResult.user.role === "clinic_owner") {
    const effectiveClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
    if (effectiveClinicId === null) {
      res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
      return;
    }
    if (doctor[0].clinicId !== effectiveClinicId) {
      res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
      return;
    }
    isOwnerOfClinic = true;
  }

  if (!isOwnerOfClinic && !isSelf) {
    res.status(403).json({ error: "Only the clinic owner or the professional themself can update this record" });
    return;
  }

  const parsed = UpdateDoctorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    name,
    email,
    specialty,
    bio,
    avatarUrl,
    consultationPrice,
    acceptsInsurance,
    insurances,
    showOnPublicPage,
    commissionPercent,
    phone,
    cpf,
    rg,
    birthDate,
    salary,
  } = parsed.data;

  if (!isOwnerOfClinic && (name !== undefined || email !== undefined || specialty !== undefined || avatarUrl !== undefined)) {
    res.status(403).json({ error: "Apenas o dono da clínica pode alterar nome, e-mail, especialidade ou foto." });
    return;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  let emailChanged = false;
  if (normalizedEmail !== undefined) {
    const [doctorUser] = await db
      .select({ email: usersTable.email, clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.id, doctor[0].userId))
      .limit(1);
    emailChanged = normalizedEmail !== doctorUser?.email.trim().toLowerCase();
    if (emailChanged && doctorUser?.clerkId && !doctorUser.clerkId.startsWith("doctor_")) {
      res.status(409).json({
        error: "Este profissional usa login externo. Altere o e-mail pelo provedor de acesso para manter a conta sincronizada.",
      });
      return;
    }

    if (emailChanged) {
      const [emailConflict] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(sql`lower(${usersTable.email}) = ${normalizedEmail}`, sql`${usersTable.id} <> ${doctor[0].userId}`))
        .limit(1);
      if (emailConflict) {
        res.status(409).json({ error: "Este e-mail já está cadastrado" });
        return;
      }
    }
  }

  // Commission percent is a financial field — only the clinic owner may set it,
  // never the professional themself.
  if (!isOwnerOfClinic && commissionPercent !== undefined) {
    res.status(403).json({ error: "Apenas o dono da clínica pode alterar o percentual de comissão." });
    return;
  }

  // Salary is owner-only as well.
  if (!isOwnerOfClinic && salary !== undefined) {
    res.status(403).json({ error: "Apenas o dono da clínica pode alterar o salário." });
    return;
  }

  if (name !== undefined || emailChanged || avatarUrl !== undefined) {
    try {
      await db
        .update(usersTable)
        .set({
          ...(name !== undefined ? { name } : {}),
          ...(emailChanged ? { email: normalizedEmail! } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        })
        .where(eq(usersTable.id, doctor[0].userId));
    } catch (err: unknown) {
      if (emailChanged && typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
        res.status(409).json({ error: "Este e-mail já está cadastrado" });
        return;
      }
      throw err;
    }
  }

  if (
    specialty ||
    bio !== undefined ||
    consultationPrice !== undefined ||
    acceptsInsurance !== undefined ||
    showOnPublicPage !== undefined ||
    commissionPercent !== undefined ||
    phone !== undefined ||
    cpf !== undefined ||
    rg !== undefined ||
    birthDate !== undefined ||
    salary !== undefined
  ) {
    await db
      .update(doctorsTable)
      .set({
        ...(specialty ? { specialty } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(consultationPrice !== undefined ? { consultationPrice: consultationPrice != null ? consultationPrice.toString() : null } : {}),
        ...(acceptsInsurance !== undefined ? { acceptsInsurance } : {}),
        ...(showOnPublicPage !== undefined ? { showOnPublicPage } : {}),
        ...(commissionPercent !== undefined
          ? { commissionPercent: commissionPercent != null ? commissionPercent.toString() : null }
          : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(cpf !== undefined ? { cpf } : {}),
        ...(rg !== undefined ? { rg } : {}),
        ...(birthDate !== undefined ? { birthDate: birthDate != null ? (birthDate instanceof Date ? birthDate.toISOString().split("T")[0] : String(birthDate)) : null } : {}),
        ...(salary !== undefined ? { salary: salary != null ? salary.toString() : null } : {}),
      })
      .where(eq(doctorsTable.id, doctorId));
  }

  if (insurances !== undefined) {
    await replaceDoctorInsurances(doctorId, insurances);
  }

  const updated = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  const result = await buildDoctorResponse(updated[0], authResult.user.role);
  res.json(result);
});

router.get("/doctors/:doctorId/reviews", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const raw = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const doctorId = parseInt(raw, 10);

  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (!doctor) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }

  // Reviews are internal to the clinic staff — never public, never visible to
  // patients (they would see other patients' names/comments). Only the clinic
  // owner (any doctor in their clinic) or the doctor themself (own reviews
  // only) may view this endpoint.
  if (user.role === "clinic_owner") {
    const callerClinicId = (await resolveOwnerClinicId(user.id, authResult.clinicId)) ?? null;
    if (callerClinicId === null || callerClinicId !== doctor.clinicId) {
      res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
      return;
    }
  } else if (user.role === "profissional_saude") {
    if (doctor.userId !== user.id) {
      res.status(403).json({ error: "Você só pode ver suas próprias avaliações." });
      return;
    }
  } else {
    res.status(403).json({ error: "Acesso restrito à equipe da clínica." });
    return;
  }

  const rows = await db
    .select({
      id: appointmentReviewsTable.id,
      appointmentId: appointmentReviewsTable.appointmentId,
      patientId: appointmentReviewsTable.patientId,
      patientName: usersTable.name,
      doctorId: appointmentReviewsTable.doctorId,
      rating: appointmentReviewsTable.rating,
      comment: appointmentReviewsTable.comment,
      createdAt: appointmentReviewsTable.createdAt,
    })
    .from(appointmentReviewsTable)
    .innerJoin(patientsTable, eq(patientsTable.id, appointmentReviewsTable.patientId))
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(eq(appointmentReviewsTable.doctorId, doctorId))
    .orderBy(desc(appointmentReviewsTable.createdAt));

  const reviewCount = rows.length;
  const avgRating =
    reviewCount > 0 ? Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10 : null;

  res.json({
    doctorId,
    avgRating,
    reviewCount,
    reviews: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
});

router.post("/doctors/:doctorId/reassign-patients", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can reassign patients" });
    return;
  }

  const raw = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const doctorId = parseInt(raw, 10);

  const { targetDoctorId } = req.body as { targetDoctorId: unknown };
  if (!targetDoctorId || typeof targetDoctorId !== "number") {
    res.status(400).json({ error: "targetDoctorId is required and must be a number" });
    return;
  }

  if (doctorId === targetDoctorId) {
    res.status(400).json({ error: "targetDoctorId must be different from the source doctor" });
    return;
  }

  const [sourceDoctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (!sourceDoctor) {
    res.status(404).json({ error: "Source doctor not found" });
    return;
  }

  const reassignClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (reassignClinicId === null) {
    res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
    return;
  }
  if (sourceDoctor.clinicId !== reassignClinicId) {
    res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
    return;
  }

  const [targetDoctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, targetDoctorId)).limit(1);
  if (!targetDoctor) {
    res.status(404).json({ error: "Target doctor not found" });
    return;
  }

  if (targetDoctor.clinicId !== reassignClinicId) {
    res.status(403).json({ error: "O profissional de destino não pertence à sua clínica." });
    return;
  }

  const assignments = await db
    .select({ patientId: patientDoctorsTable.patientId })
    .from(patientDoctorsTable)
    .where(eq(patientDoctorsTable.doctorId, doctorId));

  const patientIds = assignments.map((a) => a.patientId);

  if (patientIds.length > 0) {
    await db
      .insert(patientDoctorsTable)
      .values(patientIds.map((patientId) => ({ patientId, doctorId: targetDoctorId })))
      .onConflictDoNothing();

    await db
      .delete(patientDoctorsTable)
      .where(sql`${patientDoctorsTable.doctorId} = ${doctorId}`);
  }

  res.json({ reassignedCount: patientIds.length });
});

router.delete("/doctors/:doctorId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can remove doctors" });
    return;
  }

  const raw = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const doctorId = parseInt(raw, 10);

  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  const deleteClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (deleteClinicId === null) {
    res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
    return;
  }
  if (doctor.clinicId !== deleteClinicId) {
    res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
    return;
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(patientDoctorsTable)
    .where(eq(patientDoctorsTable.doctorId, doctorId));
  const patientCount = Number(countRow?.count ?? 0);

  const force = req.query.force === "true" || req.query.force === "1";
  if (patientCount > 0 && !force) {
    res.status(409).json({
      error: `Este profissional tem ${patientCount} paciente${patientCount !== 1 ? "s" : ""} atribuído${patientCount !== 1 ? "s" : ""}. Use force=true para remover mesmo assim.`,
      patientCount,
    });
    return;
  }

  await db
    .update(usersTable)
    .set({ deactivatedAt: new Date() })
    .where(eq(usersTable.id, doctor.userId));

  const [remainingCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(and(eq(doctorsTable.clinicId, deleteClinicId), isNull(usersTable.deactivatedAt)));
  await reconcilePlanLimitAlertOnDecrease(deleteClinicId, Number(remainingCountRow?.count ?? 0));

  res.status(204).send();
});

export default router;
