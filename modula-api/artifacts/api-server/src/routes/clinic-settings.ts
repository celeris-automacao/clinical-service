import { Router } from "express";
import { db, clinicSettingsTable, doctorsTable, clinicsTable, usersTable, leadsTable, commercialLeadsTable, PLAN_DOCTOR_LIMITS, PLAN_LABELS, PLAN_PRICES } from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId } from "../lib/auth-helpers";
import { sendEnterprisePlanInquiryEmail } from "../lib/email";
import { z } from "zod/v4";
import { and, eq, isNull, sql } from "drizzle-orm";

const router = Router();

const planEnum = z.enum(["basic", "pro", "professional", "enterprise"]);

const DEFAULT_CLINIC_NAME = "";

/**
 * Resolve the clinic for the current user:
 * - clinic_owner: uses the clinic selected via the clinic-scoped JWT (see
 *   POST /auth/select-clinic), falling back to their first linked clinic if
 *   no clinic has been selected yet.
 * - patient/doctor with clinic-scoped JWT: uses req.clinicId
 * - Falls back to the global singleton row if nothing is linked (backward compat)
 */
async function resolveClinicId(userId: number, clinicIdFromJwt?: number): Promise<number | null> {
  const clinicId = await resolveOwnerClinicId(userId, clinicIdFromJwt);
  return clinicId ?? null;
}

async function getOrCreateSettings(clinicId?: number | null) {
  if (clinicId != null) {
    // Per-clinic settings
    const [existing] = await db
      .select()
      .from(clinicSettingsTable)
      .where(eq(clinicSettingsTable.clinicId, clinicId))
      .limit(1);
    if (existing) return existing;

    // Get clinic name from clinics table to use as default
    const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1);
    const [created] = await db
      .insert(clinicSettingsTable)
      .values({ clinicId, plan: "basic", clinicName: clinic?.name ?? null })
      .returning();
    return created!;
  }

  // Legacy: global singleton (no clinicId)
  const [existing] = await db
    .select()
    .from(clinicSettingsTable)
    .where(sql`${clinicSettingsTable.clinicId} IS NULL`)
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(clinicSettingsTable).values({ plan: "basic" }).returning();
  return created!;
}

// ─── GET /clinic/branding (public) ────────────────────────────────────────────
router.get("/clinic/branding", async (req, res): Promise<void> => {
  // If clinicId is provided as query param, fetch that clinic's branding
  const clinicIdParam = req.query.clinicId ? Number(req.query.clinicId) : undefined;
  const settings = await getOrCreateSettings(clinicIdParam);
  res.json({
    clinicName: settings.clinicName ?? DEFAULT_CLINIC_NAME,
    logoUrl: settings.logoUrl ?? null,
    senderName: settings.senderName ?? null,
    fromEmail: settings.fromEmail ?? null,
    replyToEmail: settings.replyToEmail ?? null,
    privacyPolicyUrl: settings.privacyPolicyUrl ?? null,
    termsUrl: settings.termsUrl ?? null,
    copyrightUrl: settings.copyrightUrl ?? null,
    contactUrl: settings.contactUrl ?? null,
    deletionRequestUrl: settings.deletionRequestUrl ?? null,
    updatedAt: settings.updatedAt.toISOString(),
    version: settings.brandingVersion,
  });
});

// ─── PATCH /clinic/branding ───────────────────────────────────────────────────
router.patch("/clinic/branding", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Acesso restrito ao proprietário" });
    return;
  }

  const parsed = z.object({
    clinicName: z.string().trim().min(1).optional(),
    logoUrl: z.string().startsWith("/objects/").nullable().optional(),
    senderName: z.string().trim().min(1).nullable().optional(),
    fromEmail: z.string().email().nullable().optional(),
    replyToEmail: z.string().email().nullable().optional(),
    privacyPolicyUrl: z.string().url().nullable().optional(),
    termsUrl: z.string().url().nullable().optional(),
    copyrightUrl: z.string().url().nullable().optional(),
    contactUrl: z.string().url().nullable().optional(),
    deletionRequestUrl: z.string().url().nullable().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    const logoUrlIssue = parsed.error.issues.some((i) => i.path.includes("logoUrl"));
    res.status(400).json({
      error: logoUrlIssue
        ? "logoUrl inválido: deve ser um caminho de object storage (começa com /objects/)"
        : "Dados inválidos",
    });
    return;
  }

  const clinicId = await resolveClinicId(authResult.user.id, authResult.clinicId);

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
    brandingVersion: sql`${clinicSettingsTable.brandingVersion} + 1`,
  };
  if (parsed.data.clinicName !== undefined) updateData.clinicName = parsed.data.clinicName;
  if (parsed.data.logoUrl !== undefined) updateData.logoUrl = parsed.data.logoUrl;
  if (parsed.data.senderName !== undefined) updateData.senderName = parsed.data.senderName;
  if (parsed.data.fromEmail !== undefined) updateData.fromEmail = parsed.data.fromEmail;
  if (parsed.data.replyToEmail !== undefined) updateData.replyToEmail = parsed.data.replyToEmail;
  if (parsed.data.privacyPolicyUrl !== undefined) updateData.privacyPolicyUrl = parsed.data.privacyPolicyUrl;
  if (parsed.data.termsUrl !== undefined) updateData.termsUrl = parsed.data.termsUrl;
  if (parsed.data.copyrightUrl !== undefined) updateData.copyrightUrl = parsed.data.copyrightUrl;
  if (parsed.data.contactUrl !== undefined) updateData.contactUrl = parsed.data.contactUrl;
  if (parsed.data.deletionRequestUrl !== undefined) updateData.deletionRequestUrl = parsed.data.deletionRequestUrl;

  if (clinicId != null) {
    await db.update(clinicSettingsTable).set(updateData).where(eq(clinicSettingsTable.clinicId, clinicId));
  } else {
    await db.update(clinicSettingsTable).set(updateData).where(sql`${clinicSettingsTable.clinicId} IS NULL`);
  }

  const settings = await getOrCreateSettings(clinicId);

  res.json({
    clinicName: settings.clinicName ?? DEFAULT_CLINIC_NAME,
    logoUrl: settings.logoUrl ?? null,
    senderName: settings.senderName ?? null,
    fromEmail: settings.fromEmail ?? null,
    replyToEmail: settings.replyToEmail ?? null,
    privacyPolicyUrl: settings.privacyPolicyUrl ?? null,
    termsUrl: settings.termsUrl ?? null,
    copyrightUrl: settings.copyrightUrl ?? null,
    contactUrl: settings.contactUrl ?? null,
    deletionRequestUrl: settings.deletionRequestUrl ?? null,
    updatedAt: settings.updatedAt.toISOString(),
    version: settings.brandingVersion,
  });
});

// ─── GET /clinic/settings ──────────────────────────────────────────────────────
router.get("/clinic/settings", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Acesso restrito ao proprietário" });
    return;
  }

  const clinicId = await resolveClinicId(authResult.user.id, authResult.clinicId);
  const settings = await getOrCreateSettings(clinicId);

  // Count doctors in this clinic (if clinicId is known) or all doctors
  let doctorCount = 0;
  if (clinicId != null) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(doctorsTable)
      .where(eq(doctorsTable.clinicId, clinicId));
    doctorCount = Number(countRow?.count ?? 0);
  } else {
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(doctorsTable);
    doctorCount = Number(countRow?.count ?? 0);
  }

  const plan = settings.plan;
  const limit = PLAN_DOCTOR_LIMITS[plan] ?? 2;

  res.json({
    plan,
    planLabel: PLAN_LABELS[plan] ?? plan,
    planPrice: PLAN_PRICES[plan] ?? "",
    doctorLimit: limit === Infinity ? null : limit,
    doctorCount,
    updatedAt: settings.updatedAt.toISOString(),
  });
});

// ─── PATCH /clinic/settings ────────────────────────────────────────────────────
router.patch("/clinic/settings", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Acesso restrito ao proprietário" });
    return;
  }

  const parsed = z.object({ plan: planEnum }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Plano inválido" });
    return;
  }

  const clinicId = await resolveClinicId(authResult.user.id, authResult.clinicId);

  // Changing the plan resets the plan-limit-alert cycle, so a clinic that
  // upgrades and later exhausts the new limit gets fresh 90%/100% alerts.
  let updated;
  if (clinicId != null) {
    [updated] = await db
      .update(clinicSettingsTable)
      .set({ plan: parsed.data.plan, lastPlanLimitAlert: null, updatedAt: new Date() })
      .where(eq(clinicSettingsTable.clinicId, clinicId))
      .returning();
  } else {
    [updated] = await db
      .update(clinicSettingsTable)
      .set({ plan: parsed.data.plan, lastPlanLimitAlert: null, updatedAt: new Date() })
      .where(sql`${clinicSettingsTable.clinicId} IS NULL`)
      .returning();
  }

  let doctorCount = 0;
  if (clinicId != null) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(doctorsTable)
      .where(eq(doctorsTable.clinicId, clinicId));
    doctorCount = Number(countRow?.count ?? 0);
  } else {
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(doctorsTable);
    doctorCount = Number(countRow?.count ?? 0);
  }

  const plan = updated!.plan;
  const limit = PLAN_DOCTOR_LIMITS[plan] ?? 2;

  res.json({
    plan,
    planLabel: PLAN_LABELS[plan] ?? plan,
    planPrice: PLAN_PRICES[plan] ?? "",
    doctorLimit: limit === Infinity ? null : limit,
    doctorCount,
    updatedAt: updated!.updatedAt.toISOString(),
  });
});

// ─── POST /clinic/plan-inquiry ────────────────────────────────────────────────
router.post("/clinic/plan-inquiry", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Acesso restrito ao proprietário" });
    return;
  }

  const parsed = z.object({
    message: z.string().trim().max(1500).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Mensagem inválida" });
    return;
  }

  const clinicId = await resolveClinicId(authResult.user.id, authResult.clinicId);
  if (clinicId == null) {
    res.status(400).json({ error: "Nenhuma clínica vinculada à conta" });
    return;
  }

  const [clinic] = await db
    .select({ name: clinicsTable.name })
    .from(clinicsTable)
    .where(eq(clinicsTable.id, clinicId))
    .limit(1);
  if (!clinic) {
    res.status(404).json({ error: "Clínica não encontrada" });
    return;
  }

  const configuredRecipients = (process.env.PLAN_INQUIRY_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  if (configuredRecipients.some((email) => !z.string().email().safeParse(email).success)) {
    req.log.error({ recipientCount: configuredRecipients.length }, "Invalid PLAN_INQUIRY_EMAIL configuration; commercial lead will still be saved");
  }

  const adminRecipients = configuredRecipients.every((email) => z.string().email().safeParse(email).success)
    ? configuredRecipients.length > 0
      ? configuredRecipients
      : (await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(and(eq(usersTable.role, "super_admin"), isNull(usersTable.deactivatedAt))))
          .map((admin) => admin.email)
    : [];

  const phone = authResult.user.phone?.trim() || null;
  const notes = [
    `Solicitação de upgrade para Enterprise da clínica ${clinic.name}.`,
    `Responsável: ${authResult.user.name} (${authResult.user.email}${phone ? `, ${phone}` : ""}).`,
    parsed.data.message ? `Necessidade informada: ${parsed.data.message}` : "",
  ].filter(Boolean).join("\n");
  await db.transaction(async (tx) => {
    await tx.insert(leadsTable).values({
      clinicId,
      authorUserId: authResult.user.id,
      name: authResult.user.name,
      contact: phone ?? authResult.user.email,
      source: "Solicitação de upgrade Enterprise",
      notes,
      status: "novo",
    });
    await tx.insert(commercialLeadsTable).values({
      type: "enterprise_upgrade",
      clinicId,
      name: authResult.user.name,
      email: authResult.user.email,
      phone,
      message: parsed.data.message || null,
      status: "novo",
    });
  });

  if (adminRecipients.length === 0) {
    req.log.warn({ clinicId }, "Enterprise upgrade was saved to commercial leads without an email recipient");
  } else {
    try {
      await sendEnterprisePlanInquiryEmail({
        to: adminRecipients,
        clinicName: clinic.name,
        ownerName: authResult.user.name,
        ownerEmail: authResult.user.email,
        message: parsed.data.message,
      });
    } catch (error) {
      req.log.error({ err: error, clinicId, recipientCount: adminRecipients.length }, "Commercial lead saved but Enterprise notification email failed");
    }
  }
  res.status(202).json({ received: true });
});

export default router;
