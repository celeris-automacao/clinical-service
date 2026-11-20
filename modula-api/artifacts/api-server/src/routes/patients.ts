import { Router } from "express";
import { randomBytes } from "crypto";
import { and, eq, ilike, sql, desc, notExists, inArray, isNotNull, isNull, ne, type SQL, exists } from "drizzle-orm";
import { db, usersTable, patientsTable, patientDoctorsTable, doctorsTable, doctorInsurancesTable, weightEntriesTable, xpEntriesTable, checkInsTable, clinicSettingsTable, patientClinicsTable, clinicOwnersTable, dataAccessLogTable, auditFailuresTable, staffEventsTable, auditAlertCooldownTable, carePackagesTable, patientPackagesTable, patientPackageDoctorsTable, clinicsTable } from "@workspace/db";
import { requireAuth, isError, ensurePatientAccess, ensureClinicAccess, ACCESS_TOKEN_PREFIX, hashAccessToken, resolveCallerClinicId } from "../lib/auth-helpers";
import { getDaysUntilNextBirthday } from "../lib/birthdayHelpers";
import { hashPassword } from "../lib/jwt";
import { sendTempPasswordEmail, sendAuditFailureAlertEmail } from "../lib/email";
import { normalizeCpf, isValidCpf, formatCpfMask } from "../lib/cpf";
import { serializePatientResponse, type PatientResponseBase } from "../lib/patient-response-policy";
import {
  CreatePatientBody,
  UpdatePatientBody,
  AssignDoctorBody,
  UpdateNutritionGoalsBody,
  ProposeWeightGoalBody,
  ValidateWeightGoalBody,
  UpdateMyPushTokenBody,
  UpdateMyReminderSettingsBody,
} from "@workspace/api-zod";

const router = Router();

async function enrollPatientInClinic(
  patientId: number,
  clinicId: number | null,
  creatorDoctorId: number | null,
  additionalDoctorIds: number[] | undefined,
): Promise<void> {
  if (clinicId === null) return;

  await db
    .insert(patientClinicsTable)
    .values({ patientId, clinicId })
    .onConflictDoNothing();

  const doctorIds = new Set(additionalDoctorIds ?? []);
  if (creatorDoctorId !== null) doctorIds.add(creatorDoctorId);
  if (doctorIds.size === 0) return;

  const eligibleDoctors = await db
    .select({ id: doctorsTable.id })
    .from(doctorsTable)
    .where(and(inArray(doctorsTable.id, [...doctorIds]), eq(doctorsTable.clinicId, clinicId)));

  if (eligibleDoctors.length > 0) {
    await db
      .insert(patientDoctorsTable)
      .values(eligibleDoctors.map(({ id }) => ({ patientId, doctorId: id })))
      .onConflictDoNothing();
  }
}

/**
 * Two-layer cooldown tracker for audit failure alert emails.
 *
 * L1 (in-memory Map): fast path — avoids a DB round-trip on the hot path when
 *   the process has already sent (or suppressed) an alert this hour.
 * L2 (audit_alert_cooldown table): persistent — survives server restarts, which
 *   are most likely during an outage (exactly when bursts would happen otherwise).
 *
 * Read order: L1 hit â†’ skip DB. L1 miss â†’ query DB â†’ populate L1.
 * Write order: DB upsert first, then update L1 to keep them in sync.
 */
const auditAlertCooldownL1 = new Map<number, number>();
const AUDIT_ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

async function getLastAlertSentMs(clinicId: number): Promise<number> {
  const l1 = auditAlertCooldownL1.get(clinicId);
  if (l1 !== undefined) return l1;

  try {
    const [row] = await db
      .select({ lastSentAt: auditAlertCooldownTable.lastSentAt })
      .from(auditAlertCooldownTable)
      .where(eq(auditAlertCooldownTable.clinicId, clinicId))
      .limit(1);
    const ts = row ? row.lastSentAt.getTime() : 0;
    auditAlertCooldownL1.set(clinicId, ts);
    return ts;
  } catch {
    return 0;
  }
}

async function markAlertSent(clinicId: number, now: number): Promise<void> {
  const sentAt = new Date(now);
  try {
    await db
      .insert(auditAlertCooldownTable)
      .values({ clinicId, lastSentAt: sentAt })
      .onConflictDoUpdate({
        target: auditAlertCooldownTable.clinicId,
        set: { lastSentAt: sentAt },
      });
  } catch {
    // Non-fatal: the L1 cache will still suppress duplicates within this process lifetime.
  }
  auditAlertCooldownL1.set(clinicId, now);
}

/**
 * Writes a LGPD Art. 37 data-access log entry with one automatic retry.
 *
 * Trade-off (intentional): the patient GET response is never blocked or
 * degraded by an audit-write failure. Availability takes precedence over
 * write-path synchrony. In exchange, any final failure is logged at ERROR
 * level with full structured context so an ops alert or log query can catch
 * missed audit records.
 *
 * When both retries fail, all clinic owners are notified by email (rate-limited
 * to one alert per clinic per hour) so they're alerted even if they're not
 * actively monitoring the web portal.
 */
async function writeDataAccessLog(
  logEntry: Omit<typeof dataAccessLogTable.$inferInsert, "id" | "accessedAt">,
  req: import("express").Request
): Promise<void> {
  const RETRY_DELAY_MS = 500;
  const MAX_ATTEMPTS = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await db.insert(dataAccessLogTable).values(logEntry);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  req.log.error(
    {
      err: lastError,
      audit_failure: true,
      accessorUserId: logEntry.accessorUserId,
      accessorRole: logEntry.accessorRole,
      patientId: logEntry.patientId,
      clinicId: logEntry.clinicId,
      fieldsAccessed: logEntry.fieldsAccessed,
    },
    "LGPD audit write failed after all retries — access log record was NOT persisted"
  );

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

  let auditFailureId: number | null = null;
  try {
    const [inserted] = await db.insert(auditFailuresTable).values({
      clinicId: logEntry.clinicId ?? null,
      accessorUserId: logEntry.accessorUserId,
      patientId: logEntry.patientId,
      accessorRole: logEntry.accessorRole,
      fieldsAccessed: logEntry.fieldsAccessed ?? [],
      errorMessage,
    }).returning({ id: auditFailuresTable.id });
    auditFailureId = inserted?.id ?? null;
  } catch (persistErr) {
    req.log.error({ err: persistErr }, "Failed to persist audit failure record");
  }

  if (logEntry.clinicId) {
    try {
      await db.insert(staffEventsTable).values({
        userId: logEntry.accessorUserId,
        clinicId: logEntry.clinicId,
        type: "audit_write_failure",
        description: `Falha ao registrar acesso a dados sensíveis (LGPD Art. 37). Verifique o log de conformidade imediatamente.`,
      });
    } catch (eventErr) {
      req.log.error({ err: eventErr }, "Failed to create staff event for audit failure");
    }

    // Send email alert to clinic owners — rate-limited to one per clinic per hour.
    // Cooldown is persisted to the DB so restarts during an outage don't reset it.
    const clinicId = logEntry.clinicId;

    // Guard: skip the entire email-dispatch block if the owner was already
    // notified for this specific row (ownerNotifiedAt IS NOT NULL). This prevents
    // duplicate emails from background retries or a server restart replaying the
    // same auditFailureId that was already stamped before the process died.
    if (auditFailureId !== null) {
      try {
        const [existingRow] = await db
          .select({ ownerNotifiedAt: auditFailuresTable.ownerNotifiedAt })
          .from(auditFailuresTable)
          .where(eq(auditFailuresTable.id, auditFailureId))
          .limit(1);
        if (existingRow?.ownerNotifiedAt != null) {
          req.log.warn(
            { auditFailureId },
            "Audit failure owner notification already sent — skipping duplicate email dispatch"
          );
          return;
        }
      } catch (checkErr) {
        req.log.error({ err: checkErr, auditFailureId }, "Failed to check ownerNotifiedAt before email dispatch — proceeding anyway");
      }
    }

    const now = Date.now();
    const lastSent = await getLastAlertSentMs(clinicId);
    if (now - lastSent >= AUDIT_ALERT_COOLDOWN_MS) {
      await markAlertSent(clinicId, now);
      try {
        const owners = await db
          .select({ email: usersTable.email, name: usersTable.name })
          .from(clinicOwnersTable)
          .innerJoin(usersTable, eq(usersTable.id, clinicOwnersTable.userId))
          .where(eq(clinicOwnersTable.clinicId, clinicId));

        const branding = await fetchClinicBranding();

        let anyEmailSent = false;
        const notifiedAt = new Date();
        for (const owner of owners) {
          try {
            await sendAuditFailureAlertEmail({
              to: owner.email,
              ownerName: owner.name,
              clinicName: branding.clinicName,
              fromEmail: branding.fromEmail,
              replyToEmail: branding.replyToEmail,
              errorMessage,
              accessorUserId: logEntry.accessorUserId,
              accessorRole: logEntry.accessorRole,
              patientId: logEntry.patientId ?? null,
              failedAt: notifiedAt,
            });
            anyEmailSent = true;
          } catch (emailErr) {
            req.log.error({ err: emailErr, to: owner.email }, "Failed to send audit failure alert email to owner");
          }
        }

        // Persist the notification timestamp so the LGPD panel can show the indicator.
        // The WHERE clause includes isNull(ownerNotifiedAt) so this is idempotent —
        // a concurrent or replayed update won't overwrite an already-stamped row.
        if (anyEmailSent && auditFailureId !== null) {
          try {
            await db
              .update(auditFailuresTable)
              .set({ ownerNotifiedAt: notifiedAt })
              .where(and(eq(auditFailuresTable.id, auditFailureId), isNull(auditFailuresTable.ownerNotifiedAt)));
          } catch (updateErr) {
            req.log.error({ err: updateErr, auditFailureId }, "Failed to set ownerNotifiedAt on audit failure record");
          }
        }
      } catch (lookupErr) {
        req.log.error({ err: lookupErr, clinicId }, "Failed to look up clinic owners for audit failure alert email");
      }
    } else {
      req.log.warn(
        { clinicId, cooldownRemainingMs: AUDIT_ALERT_COOLDOWN_MS - (now - lastSent) },
        "Audit failure alert email suppressed by cooldown"
      );
      // Even though no new email is sent, stamp ownerNotifiedAt with the time of
      // the most-recent alert that covers this window so the LGPD panel shows the
      // notification indicator instead of leaving the record looking unreviewed.
      // The WHERE clause includes isNull(ownerNotifiedAt) to make this idempotent.
      if (auditFailureId !== null) {
        try {
          await db
            .update(auditFailuresTable)
            .set({ ownerNotifiedAt: new Date(lastSent) })
            .where(and(eq(auditFailuresTable.id, auditFailureId), isNull(auditFailuresTable.ownerNotifiedAt)));
        } catch (updateErr) {
          req.log.error(
            { err: updateErr, auditFailureId, lastSent },
            "Failed to set ownerNotifiedAt (suppressed-by-cooldown) on audit failure record"
          );
        }
      }
    }
  }
}

async function fetchClinicBranding() {
  const [settings] = await db.select().from(clinicSettingsTable).limit(1);
  return {
    clinicName: settings?.clinicName ?? null,
    senderName: settings?.senderName ?? null,
    fromEmail: settings?.fromEmail ?? null,
    replyToEmail: settings?.replyToEmail ?? null,
  };
}

function maskIdentityName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Paciente";
  if (parts.length === 1) return `${parts[0].slice(0, 1)}.`;
  return [parts[0], ...parts.slice(1).map((part) => `${part.slice(0, 1)}.`)].join(" ");
}

function maskIdentityEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

function maskIdentityPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `(**) *****-${digits.slice(-4)}`;
}

function maskIdentityBirthDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, year, month] = match;
  return `**/${month}/${year}`;
}

async function buildPatientResponse(
  patient: typeof patientsTable.$inferSelect & { user?: typeof usersTable.$inferSelect },
  viewerRole?: string
) {
  const user = patient.user ?? (await db.select().from(usersTable).where(eq(usersTable.id, patient.userId)).limit(1))[0];

  const latestWeight = await db
    .select()
    .from(weightEntriesTable)
    .where(eq(weightEntriesTable.patientId, patient.id))
    .orderBy(desc(weightEntriesTable.date))
    .limit(1);

  const xpResult = await db
    .select({ total: sql<number>`coalesce(sum(${xpEntriesTable.points}), 0)` })
    .from(xpEntriesTable)
    .where(eq(xpEntriesTable.patientId, patient.id));

  const totalXp = Number(xpResult[0]?.total ?? 0);
  const currentWeight = latestWeight[0] ? Number(latestWeight[0].weightKg) : null;

  let weightGoalValidatedByName: string | null = null;
  if (patient.weightGoalValidatedByUserId) {
    const [validator] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, patient.weightGoalValidatedByUserId))
      .limit(1);
    weightGoalValidatedByName = validator?.name ?? null;
  }

  const careTeamRows = await db
    .select({ doctor: doctorsTable, doctorUser: usersTable })
    .from(patientDoctorsTable)
    .innerJoin(doctorsTable, eq(doctorsTable.id, patientDoctorsTable.doctorId))
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(eq(patientDoctorsTable.patientId, patient.id));

  const careTeamDoctorIds = careTeamRows.map(({ doctor }) => doctor.id);
  const careTeamInsuranceRows = careTeamDoctorIds.length
    ? await db
        .select()
        .from(doctorInsurancesTable)
        .where(inArray(doctorInsurancesTable.doctorId, careTeamDoctorIds))
    : [];

  const careTeam = careTeamRows.map(({ doctor, doctorUser }) => ({
    id: doctor.id,
    userId: doctor.userId,
    name: doctorUser.name,
    avatarUrl: doctorUser.avatarUrl ?? null,
    specialty: doctor.specialty,
    consultationPrice: doctor.consultationPrice != null ? String(doctor.consultationPrice) : null,
    acceptsInsurance: doctor.acceptsInsurance,
    insurances: careTeamInsuranceRows
      .filter((i) => i.doctorId === doctor.id)
      .map((i) => ({ id: i.id, name: i.name, price: Number(i.price) })),
  }));

  const response: PatientResponseBase = {
    id: patient.id,
    userId: patient.userId,
    clinicId: patient.clinicId ?? null,
    name: user?.name ?? "",
    email: user?.email ?? "",
    avatarUrl: user?.avatarUrl ?? null,
    dateOfBirth: patient.dateOfBirth ?? null,
    allergies: patient.allergies ?? null,
    hasAllergies: patient.hasAllergies,
    medicalConditions: patient.medicalConditions ?? null,
    dietaryRestrictions: patient.dietaryRestrictions ?? null,
    hasDietaryRestrictions: patient.hasDietaryRestrictions,
    psychologyNotes: patient.psychologyNotes ?? null,
    physicalActivityNotes: patient.physicalActivityNotes ?? null,
    endocrinologyNotes: patient.endocrinologyNotes ?? null,
    phone: patient.phone || user?.phone || null,
    cpf: patient.cpf ?? null,
    rg: patient.rg ?? null,
    addressStreet: patient.addressStreet ?? null,
    addressNumber: patient.addressNumber ?? null,
    addressComplement: patient.addressComplement ?? null,
    addressNeighborhood: patient.addressNeighborhood ?? null,
    addressCity: patient.addressCity ?? null,
    addressState: patient.addressState ?? null,
    addressZip: patient.addressZip ?? null,
    // Payment/insurance info is internal admin data — never exposed to the patient app.
    ...(viewerRole !== "patient"
      ? { paymentType: patient.paymentType, insuranceName: patient.insuranceName ?? null }
      : {}),
    startWeight: Number(patient.startWeight),
    targetWeight: patient.targetWeight ? Number(patient.targetWeight) : null,
    proposedTargetWeight: patient.proposedTargetWeight ? Number(patient.proposedTargetWeight) : null,
    weightGoalStatus: patient.weightGoalStatus,
    weightGoalValidatedByName,
    weightGoalValidatedAt: patient.weightGoalValidatedAt ? patient.weightGoalValidatedAt.toISOString() : null,
    currentWeight,
    totalXp,
    isTemporaryPassword: user?.isTemporaryPassword ?? false,
    temporaryPasswordExpiresAt: user?.temporaryPasswordExpiresAt ? user.temporaryPasswordExpiresAt.toISOString() : null,
    dailyCalorieGoal: patient.dailyCalorieGoal ?? null,
    createdAt: patient.createdAt.toISOString(),
    careTeam,
    reminderSettings: {
      water: {
        enabled: patient.waterReminderEnabled ?? null,
        hour: patient.waterReminderHour ?? null,
        minute: patient.waterReminderMinute ?? null,
        frequency: patient.waterReminderFrequency ?? null,
      },
      weight: {
        enabled: patient.weightReminderEnabled ?? null,
        hour: patient.weightReminderHour ?? null,
        minute: patient.weightReminderMinute ?? null,
        frequency: patient.weightReminderFrequency ?? null,
      },
    },
  };

  return serializePatientResponse(response, viewerRole ?? "clinic_owner");
}

/**
 * Resolve the effective clinic ID for a clinic_owner.
 * Returns the owner's clinic ID, or null if not linked.
 */
async function resolveOwnerClinicId(userId: number, clinicIdFromJwt?: number): Promise<number | null> {
  if (clinicIdFromJwt !== undefined) return clinicIdFromJwt;
  const [row] = await db
    .select({ clinicId: clinicOwnersTable.clinicId })
    .from(clinicOwnersTable)
    .where(eq(clinicOwnersTable.userId, userId))
    .limit(1);
  return row?.clinicId ?? null;
}

type PatientTreatmentResponse = {
  patientId: number;
  patientName: string;
  clinics: Array<{
    clinicId: number;
    clinicName: string;
    clinicLogoUrl: string | null;
    treatments: Array<{
      enrollmentId: number;
      packageId: number;
      packageName: string;
      packageDescription: string | null;
      status: "active";
      startDate: string;
      endDate: string;
      doctors: Array<{
        doctorId: number;
        doctorName: string;
        specialty: string;
      }>;
    }>;
  }>;
};

router.get("/patients/me/treatments", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem visualizar seus tratamentos." });
    return;
  }

  const [patient] = await db
    .select({ id: patientsTable.id, userId: patientsTable.userId })
    .from(patientsTable)
    .where(eq(patientsTable.userId, authResult.user.id))
    .limit(1);

  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado." });
    return;
  }

  const [user] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, authResult.user.id))
    .limit(1);

  const activeEnrollments = await db
    .select({
      enrollmentId: patientPackagesTable.id,
      packageId: patientPackagesTable.packageId,
      packageName: carePackagesTable.name,
      packageDescription: carePackagesTable.description,
      clinicId: patientPackagesTable.clinicId,
      clinicName: clinicsTable.name,
      clinicLogoUrl: clinicsTable.logoUrl,
      startDate: patientPackagesTable.startDate,
      endDate: patientPackagesTable.endDate,
    })
    .from(patientPackagesTable)
    .innerJoin(carePackagesTable, eq(carePackagesTable.id, patientPackagesTable.packageId))
    .innerJoin(clinicsTable, eq(clinicsTable.id, patientPackagesTable.clinicId))
    .where(and(
      eq(patientPackagesTable.patientId, patient.id),
      eq(patientPackagesTable.status, "active"),
    ))
    .orderBy(clinicsTable.name, carePackagesTable.name, patientPackagesTable.startDate);

  if (activeEnrollments.length === 0) {
    const response: PatientTreatmentResponse = {
      patientId: patient.id,
      patientName: user?.name ?? authResult.user.name,
      clinics: [],
    };
    res.json(response);
    return;
  }

  const enrollmentIds = activeEnrollments.map((row) => row.enrollmentId);
  const doctorsByEnrollment = await db
    .select({
      enrollmentId: patientPackageDoctorsTable.patientPackageId,
      doctorId: doctorsTable.id,
      doctorName: usersTable.name,
      specialty: doctorsTable.specialty,
    })
    .from(patientPackageDoctorsTable)
    .innerJoin(doctorsTable, eq(doctorsTable.id, patientPackageDoctorsTable.doctorId))
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(inArray(patientPackageDoctorsTable.patientPackageId, enrollmentIds))
    .orderBy(usersTable.name);

  const doctorsMap = new Map<number, Array<{ doctorId: number; doctorName: string; specialty: string }>>();
  for (const row of doctorsByEnrollment) {
    const list = doctorsMap.get(row.enrollmentId) ?? [];
    list.push({ doctorId: row.doctorId, doctorName: row.doctorName, specialty: row.specialty });
    doctorsMap.set(row.enrollmentId, list);
  }

  const clinicsMap = new Map<number, PatientTreatmentResponse["clinics"][number]>();
  for (const row of activeEnrollments) {
    const clinic = clinicsMap.get(row.clinicId) ?? {
      clinicId: row.clinicId,
      clinicName: row.clinicName,
      clinicLogoUrl: row.clinicLogoUrl ?? null,
      treatments: [],
    };
      clinic.treatments.push({
        enrollmentId: row.enrollmentId,
        packageId: row.packageId,
        packageName: row.packageName,
        packageDescription: row.packageDescription ?? null,
        status: "active",
        startDate: row.startDate,
        endDate: row.endDate,
        doctors: doctorsMap.get(row.enrollmentId) ?? [],
      });
    clinicsMap.set(row.clinicId, clinic);
  }

  const response: PatientTreatmentResponse = {
    patientId: patient.id,
    patientName: user?.name ?? authResult.user.name,
    clinics: [...clinicsMap.values()],
  };
  res.json(response);
});

// Registers (or clears) the current patient's Expo push token, used by the
// server-side appointment reminder job as a fallback for local notifications.
router.patch("/patients/me/push-token", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  if (authResult.user.role !== "patient") {
    res.status(404).json({ error: "Authenticated user is not a patient" });
    return;
  }

  const parsed = UpdateMyPushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(eq(patientsTable.userId, authResult.user.id))
    .limit(1);

  if (!patient) {
    res.status(404).json({ error: "Authenticated user is not a patient" });
    return;
  }

  await db
    .update(patientsTable)
    .set({ pushToken: parsed.data.pushToken ?? null })
    .where(eq(patientsTable.id, patient.id));

  res.json({ success: true });
});

// Sync the current patient's local water/weigh-in reminder settings to the
// server so clinic staff can see them on the web cockpit. Scheduling stays
// fully local on the phone; this only mirrors state for visibility.
router.patch("/patients/me/reminder-settings", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  if (authResult.user.role !== "patient") {
    res.status(404).json({ error: "Authenticated user is not a patient" });
    return;
  }

  const parsed = UpdateMyReminderSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.userId, authResult.user.id))
    .limit(1);

  if (!patient) {
    res.status(404).json({ error: "Authenticated user is not a patient" });
    return;
  }

  const updates: Partial<typeof patientsTable.$inferInsert> = {};
  if (parsed.data.water) {
    if (parsed.data.water.enabled !== undefined) updates.waterReminderEnabled = parsed.data.water.enabled;
    if (parsed.data.water.hour !== undefined) updates.waterReminderHour = parsed.data.water.hour;
    if (parsed.data.water.minute !== undefined) updates.waterReminderMinute = parsed.data.water.minute;
    if (parsed.data.water.frequency !== undefined) updates.waterReminderFrequency = parsed.data.water.frequency;
  }
  if (parsed.data.weight) {
    if (parsed.data.weight.enabled !== undefined) updates.weightReminderEnabled = parsed.data.weight.enabled;
    if (parsed.data.weight.hour !== undefined) updates.weightReminderHour = parsed.data.weight.hour;
    if (parsed.data.weight.minute !== undefined) updates.weightReminderMinute = parsed.data.weight.minute;
    if (parsed.data.weight.frequency !== undefined) updates.weightReminderFrequency = parsed.data.weight.frequency;
  }

  let updated = patient;
  if (Object.keys(updates).length > 0) {
    const rows = await db
      .update(patientsTable)
      .set(updates)
      .where(eq(patientsTable.id, patient.id))
      .returning();
    updated = rows[0];
  }

  res.json({
    water: {
      enabled: updated.waterReminderEnabled ?? null,
      hour: updated.waterReminderHour ?? null,
      minute: updated.waterReminderMinute ?? null,
      frequency: updated.waterReminderFrequency ?? null,
    },
    weight: {
      enabled: updated.weightReminderEnabled ?? null,
      hour: updated.weightReminderHour ?? null,
      minute: updated.weightReminderMinute ?? null,
      frequency: updated.weightReminderFrequency ?? null,
    },
  });
});

router.get("/patients", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  const search = req.query.search as string | undefined;
  const doctorId = req.query.doctorId ? Number(req.query.doctorId) : undefined;
  const unassigned = req.query.unassigned === "true";
  const activeThisWeek = req.query.activeThisWeek === "true";

  let patientIds: number[] | null = null;
  let doctorClinicId: number | null = null;

  if (user.role === "profissional_saude") {
    const doctorRecord = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, user.id)).limit(1);
    if (doctorRecord.length === 0) {
      res.json([]);
      return;
    }
    doctorClinicId = doctorRecord[0].clinicId;
    const assignments = await db
      .select({ patientId: patientDoctorsTable.patientId })
      .from(patientDoctorsTable)
      .where(eq(patientDoctorsTable.doctorId, doctorRecord[0].id));
    patientIds = assignments.map((a) => a.patientId);
    if (patientIds.length === 0) {
      res.json([]);
      return;
    }
  } else if (user.role === "patient") {
    // Patient can only see their own record
    const patientRecord = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    patientIds = patientRecord.map((p) => p.id);
  }

  // Always exclude deactivated patients from every listing
  const conditions: SQL[] = [isNull(usersTable.deactivatedAt)];

  if (search) {
    conditions.push(ilike(usersTable.name, `%${search}%`));
  }

  if (patientIds !== null) {
    if (patientIds.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(patientsTable.id, patientIds));
  }

  // Clinic scoping: clinic_owner must always be scoped to their clinic — fail closed
  if (user.role === "clinic_owner") {
    const clinicId = await resolveOwnerClinicId(user.id, authResult.clinicId);
    if (clinicId === null) {
      res.status(403).json({ error: "Administrador não vinculado a nenhuma clínica." });
      return;
    }
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(patientClinicsTable)
          .where(
            and(
              eq(patientClinicsTable.patientId, patientsTable.id),
              eq(patientClinicsTable.clinicId, clinicId)
            )
          )
      )
    );
  }

  // Doctors are also scoped to their own clinic — fail closed.
  if (doctorClinicId !== null) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(patientClinicsTable)
          .where(
            and(
              eq(patientClinicsTable.patientId, patientsTable.id),
              eq(patientClinicsTable.clinicId, doctorClinicId)
            )
          )
      )
    );
  }

  if (doctorId) {
    const assignments = await db
      .select({ patientId: patientDoctorsTable.patientId })
      .from(patientDoctorsTable)
      .where(eq(patientDoctorsTable.doctorId, doctorId));
    const ids = assignments.map((a) => a.patientId);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(patientsTable.id, ids));
  }

  if (unassigned) {
    conditions.push(
      notExists(
        db
          .select({ one: sql`1` })
          .from(patientDoctorsTable)
          .where(eq(patientDoctorsTable.patientId, patientsTable.id))
      )
    );
  }

  if (activeThisWeek) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekIso = startOfWeek.toISOString().split("T")[0];
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(checkInsTable)
          .where(
            and(
              eq(checkInsTable.patientId, patientsTable.id),
              sql`${checkInsTable.date} >= ${startOfWeekIso}`
            )
          )
      )
    );
  }

  const rows = await db
    .select({ patient: patientsTable, user: usersTable })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(and(...conditions));
  const results = await Promise.all(
    rows.map(({ patient, user: u }) => buildPatientResponse({ ...patient, user: u }, user.role))
  );
  res.json(results);
});

router.post("/patients", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (user.role !== "clinic_owner" && user.role !== "profissional_saude") {
    res.status(403).json({ error: "Only clinic owners and doctors can create patients" });
    return;
  }

  let creatorDoctorId: number | null = null;
  let creatorClinicId: number | null = null;

  if (user.role === "profissional_saude") {
    const doctorRecord = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, user.id)).limit(1);
    if (doctorRecord.length === 0) {
      res.status(403).json({ error: "Profissional não encontrado" });
      return;
    }
    creatorDoctorId = doctorRecord[0].id;
    creatorClinicId = doctorRecord[0].clinicId;
  } else {
    creatorClinicId = (await resolveOwnerClinicId(user.id, authResult.clinicId)) ?? null;
  }

  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, phone, startWeight, targetWeight, dateOfBirth, avatarUrl, additionalDoctorIds, paymentType, insuranceName, cpf, rg, addressStreet, addressNumber, addressComplement, addressNeighborhood, addressCity, addressState, addressZip } = parsed.data;
  const previewIdentity = Boolean((req.body as { previewIdentity?: boolean }).previewIdentity);
  const confirmIdentity = Boolean((req.body as { confirmIdentity?: boolean }).confirmIdentity);

  const normalizedCpf = cpf ? normalizeCpf(cpf) : null;
  if (normalizedCpf && !isValidCpf(normalizedCpf)) {
    res.status(400).json({ error: "CPF inválido. Confira os 11 dígitos e os dígitos verificadores." });
    return;
  }

  let existingCpfUser: typeof usersTable.$inferSelect | null = null;
  if (normalizedCpf) {
    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.cpf, normalizedCpf))
      .limit(1);
    if (row) {
      existingCpfUser = row;
    }
  }

  const [existingPatient] = normalizedCpf && existingCpfUser
    ? await db
        .select()
        .from(patientsTable)
        .where(eq(patientsTable.userId, existingCpfUser.id))
        .limit(1)
    : [];
  const [existingPatientClinic] = existingPatient && creatorClinicId !== null
    ? await db
        .select({ patientId: patientClinicsTable.patientId })
        .from(patientClinicsTable)
        .where(and(
          eq(patientClinicsTable.patientId, existingPatient.id),
          eq(patientClinicsTable.clinicId, creatorClinicId),
        ))
        .limit(1)
    : [];
  const existingPatientInClinic = Boolean(existingPatientClinic)
    || existingPatient?.clinicId === creatorClinicId;

  const previewPayload = normalizedCpf
    ? {
        match: existingCpfUser ? ("found" as const) : ("created" as const),
        linkedToCurrentClinic: existingPatientInClinic,
        existingPatientId: existingPatientInClinic ? existingPatient?.id ?? null : null,
        ...(existingCpfUser && existingCpfUser.role !== "patient" ? { reviewRequired: true } : {}),
        preview: {
          name: maskIdentityName(existingCpfUser?.name ?? name),
          cpf: formatCpfMask(normalizedCpf),
          birthDate: maskIdentityBirthDate(existingCpfUser?.birthDate ?? dateOfBirth ?? null),
          email: maskIdentityEmail(existingCpfUser?.email ?? email),
          phone: maskIdentityPhone(existingCpfUser?.phone ?? null),
        },
      }
    : null;

  if (previewIdentity && normalizedCpf) {
    res.status(200).json(previewPayload);
    return;
  }

  if (confirmIdentity && existingCpfUser && existingCpfUser.role !== "patient") {
    res.status(409).json({ error: "Este CPF pertence a uma conta da equipe e precisa ser revisado antes do cadastro como paciente." });
    return;
  }

  if (confirmIdentity && existingCpfUser && avatarUrl !== undefined) {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ avatarUrl })
      .where(eq(usersTable.id, existingCpfUser.id))
      .returning();
    existingCpfUser = updatedUser;
  }

  if (confirmIdentity && existingCpfUser && existingPatient) {
    let patientForResponse = existingPatient;
    if (!existingPatient.phone && !existingCpfUser.phone) {
      await db
        .update(patientsTable)
        .set({ phone })
        .where(eq(patientsTable.id, existingPatient.id));
      patientForResponse = { ...existingPatient, phone };
    }

    await enrollPatientInClinic(
      existingPatient.id,
      creatorClinicId,
      creatorDoctorId,
      additionalDoctorIds,
    );
    if (!existingPatientInClinic) {
      await db.insert(staffEventsTable).values({
        userId: user.id,
        clinicId: creatorClinicId ?? null,
        type: "patient_identity_resolved_by_cpf",
        description: `CPF ${formatCpfMask(normalizedCpf!)} processado para cadastro de paciente.`,
      }).catch(() => null);
    }
    const result = await buildPatientResponse({ ...patientForResponse, user: existingCpfUser }, user.role);
    res.status(existingPatientInClinic ? 200 : 201).json({
      ...result,
      match: "found",
      linkedToCurrentClinic: true,
    });
    return;
  }

  const tempPassword = existingCpfUser
    ? null
    : `temp_${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  const passwordHash = tempPassword ? await hashPassword(tempPassword) : null;

  const newUser = existingCpfUser
    ? [existingCpfUser]
    : await db
        .insert(usersTable)
        .values({
          clerkId: `manual_${Date.now()}`,
          email,
          name,
          phone,
          role: "patient",
          avatarUrl: avatarUrl ?? null,
          passwordHash,
          isTemporaryPassword: true,
          cpf: normalizedCpf ?? null,
        })
        .returning();

  let newPatient: (typeof patientsTable.$inferSelect)[];
  try {
    newPatient = await db
      .insert(patientsTable)
      .values({
        userId: newUser[0].id,
        clinicId: creatorClinicId ?? null,
        startWeight: String(startWeight),
        targetWeight: targetWeight ? String(targetWeight) : null,
        dateOfBirth: dateOfBirth ? (dateOfBirth instanceof Date ? dateOfBirth.toISOString().split("T")[0] : String(dateOfBirth)) : null,
        phone,
        paymentType: paymentType ?? "particular",
        insuranceName: paymentType === "convenio" ? (insuranceName ?? null) : null,
        cpf: normalizedCpf ?? null,
        rg: rg ?? null,
        addressStreet: addressStreet ?? null,
        addressNumber: addressNumber ?? null,
        addressComplement: addressComplement ?? null,
        addressNeighborhood: addressNeighborhood ?? null,
        addressCity: addressCity ?? null,
        addressState: addressState ?? null,
        addressZip: addressZip ?? null,
      })
      .returning();
  } catch (err: unknown) {
    await db.delete(usersTable).where(eq(usersTable.id, newUser[0].id)).catch(() => {});
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
      res.status(409).json({ error: "CPF já cadastrado" });
      return;
    }
    throw err;
  }

  await enrollPatientInClinic(newPatient[0].id, creatorClinicId, creatorDoctorId, additionalDoctorIds);

  const result = await buildPatientResponse({ ...newPatient[0], user: newUser[0] }, user.role);

  if (normalizedCpf) {
    await db.insert(staffEventsTable).values({
      userId: user.id,
      clinicId: creatorClinicId ?? null,
      type: existingCpfUser ? "patient_identity_resolved_by_cpf" : "patient_identity_created_by_cpf",
      description: `CPF ${formatCpfMask(normalizedCpf)} processado para cadastro de paciente.`,
    }).catch(() => null);
  }

  if (tempPassword) {
    fetchClinicBranding().then((branding) =>
      sendTempPasswordEmail({ to: email, name, tempPassword, ...branding })
    ).catch((err) => {
      req.log.error({ err, email }, "Failed to send invite email on patient creation");
    });
  }

  res.status(201).json(tempPassword ? { ...result, temporaryPassword: tempPassword } : result);
});

router.get("/patients/upcoming-birthdays", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  if (user.role !== "clinic_owner" && user.role !== "profissional_saude") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const daysParam = req.query.days ? Number(req.query.days) : 7;
  const days = Number.isInteger(daysParam) && daysParam >= 1 && daysParam <= 365 ? daysParam : 7;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine which patients this user can see
  let allowedPatientIds: number[] | null = null;
  if (user.role === "clinic_owner") {
    const ownerClinicId = await resolveOwnerClinicId(user.id, authResult.clinicId);
    if (!ownerClinicId) {
      res.json([]);
      return;
    }
    const enrollment = await db
      .select({ patientId: patientClinicsTable.patientId })
      .from(patientClinicsTable)
      .where(eq(patientClinicsTable.clinicId, ownerClinicId));
    allowedPatientIds = enrollment.map((r) => r.patientId);
    if (allowedPatientIds.length === 0) {
      res.json([]);
      return;
    }
  } else if (user.role === "profissional_saude") {
    const doctorRecord = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, user.id)).limit(1);
    if (doctorRecord.length === 0) {
      res.json([]);
      return;
    }
    const myClinicId = doctorRecord[0].clinicId;
    const assignments = await db
      .select({ patientId: patientDoctorsTable.patientId })
      .from(patientDoctorsTable)
      .where(eq(patientDoctorsTable.doctorId, doctorRecord[0].id));
    const assignedIds = assignments.map((a) => a.patientId);
    if (assignedIds.length === 0) {
      res.json([]);
      return;
    }
    // Intersect with patients enrolled in the doctor's clinic — fail-closed.
    const clinicEnrollment = await db
      .select({ patientId: patientClinicsTable.patientId })
      .from(patientClinicsTable)
      .where(eq(patientClinicsTable.clinicId, myClinicId));
    const clinicPatientSet = new Set(clinicEnrollment.map((r) => r.patientId));
    allowedPatientIds = assignedIds.filter((id) => clinicPatientSet.has(id));
    if (allowedPatientIds.length === 0) {
      res.json([]);
      return;
    }
  }

  const baseCondition = and(isNotNull(patientsTable.dateOfBirth), isNull(usersTable.deactivatedAt));
  const whereCondition = allowedPatientIds !== null
    ? and(baseCondition, inArray(patientsTable.id, allowedPatientIds))
    : baseCondition;

  const rows = await db
    .select({ patient: patientsTable, user: usersTable })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(whereCondition);

  const upcoming: Array<{
    id: number;
    name: string;
    dateOfBirth: string;
    ageTheyWillTurn: number;
    daysUntilBirthday: number;
  }> = [];

  for (const { patient, user: u } of rows) {
    if (!patient.dateOfBirth) continue;
    if (u?.deactivatedAt != null) continue;

    const diffDays = getDaysUntilNextBirthday(today, patient.dateOfBirth);

    if (diffDays <= days) {
      const dob = new Date(patient.dateOfBirth + "T00:00:00");
      const nextBirthdayYear =
        new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) >= today
          ? today.getFullYear()
          : today.getFullYear() + 1;
      const ageTheyWillTurn = nextBirthdayYear - dob.getFullYear();
      upcoming.push({
        id: patient.id,
        name: u?.name ?? "",
        dateOfBirth: patient.dateOfBirth,
        ageTheyWillTurn,
        daysUntilBirthday: diffDays,
      });
    }
  }

  upcoming.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);

  res.json(upcoming);
});

router.post("/patients/:patientId/resend-invite", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (user.role !== "clinic_owner" && user.role !== "profissional_saude" && user.role !== "secretaria") {
    res.status(403).json({ error: "Apenas donos de clínica, profissionais e secretárias podem reenviar convites" });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const rows = await db
    .select({ patient: patientsTable, user: usersTable })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(eq(patientsTable.id, patientId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Paciente não encontrado" });
    return;
  }

  const { user: patientUser, patient } = rows[0];

  // Verify caller has access to this patient (clinic-scoped for owners and staff)
  const accessOk = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!accessOk) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  // Guard: if the patient has already set their own password, refuse to overwrite it
  if (!patientUser.isTemporaryPassword) {
    res.status(409).json({ error: "O paciente já definiu sua própria senha. O convite não pode ser reenviado." });
    return;
  }

  // For doctors, verify they are assigned to this patient
  if (user.role === "profissional_saude") {
    const doctorRecord = await db
      .select()
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    if (doctorRecord.length === 0) {
      res.status(403).json({ error: "Profissional não encontrado" });
      return;
    }
    const assignment = await db
      .select()
      .from(patientDoctorsTable)
      .where(
        sql`${patientDoctorsTable.doctorId} = ${doctorRecord[0].id} AND ${patientDoctorsTable.patientId} = ${patientId}`
      )
      .limit(1);
    if (assignment.length === 0) {
      res.status(403).json({ error: "Você não tem acesso a este paciente" });
      return;
    }
  }

  // Generate a new temporary password
  const newTempPassword = `temp_${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  const passwordHash = await hashPassword(newTempPassword);

  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db
    .update(usersTable)
    .set({ passwordHash, isTemporaryPassword: true, temporaryPasswordExpiresAt: newExpiresAt })
    .where(eq(usersTable.id, patient.userId));

  try {
    const branding = await fetchClinicBranding();
    await sendTempPasswordEmail({
      to: patientUser.email,
      name: patientUser.name,
      tempPassword: newTempPassword,
      ...branding,
    });
  } catch (err) {
    req.log.error({ err, email: patientUser.email }, "Failed to send resend-invite email");
    // Still return success — the password was reset; clinic staff can relay it manually
  }

  res.json({ success: true });
});

router.post("/patients/:patientId/access-token", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can generate access tokens" });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const accessToken = `${ACCESS_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
  await db
    .update(usersTable)
    .set({ accessToken: hashAccessToken(accessToken) })
    .where(eq(usersTable.id, patient.userId));

  // The raw token is returned once here; only its hash is persisted.
  res.json({ accessToken });
});

router.get("/patients/:patientId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const result = await buildPatientResponse(patient, authResult.user.role);

  // Log all staff accesses to patient data (LGPD Art. 37 — data processing record).
  // Always write the audit entry, even when no sensitive fields are populated yet,
  // so the clinic owner has a complete audit trail with no gaps.
  if (authResult.user.role !== "patient") {
    const sensitiveFields: string[] = [];
    const fullResult = result as typeof result & {
      cpf?: string | null;
      rg?: string | null;
      medicalConditions?: string | null;
      psychologyNotes?: string | null;
      physicalActivityNotes?: string | null;
      endocrinologyNotes?: string | null;
      phone?: string | null;
    };
    if (fullResult.cpf) sensitiveFields.push("cpf");
    if (fullResult.rg) sensitiveFields.push("rg");
    if (fullResult.medicalConditions) sensitiveFields.push("medicalConditions");
    if (fullResult.psychologyNotes) sensitiveFields.push("psychologyNotes");
    if (fullResult.physicalActivityNotes) sensitiveFields.push("physicalActivityNotes");
    if (fullResult.endocrinologyNotes) sensitiveFields.push("endocrinologyNotes");
    if (fullResult.phone) sensitiveFields.push("phone");

    // Fire-and-forget: do not await so the patient GET response is never
    // blocked by an audit-write delay or failure (see writeDataAccessLog).
    // Always log staff accesses, even when no sensitive fields are populated yet,
    // so the LGPD audit trail has no gaps (LGPD Art. 37).
    resolveCallerClinicId(authResult.user, authResult.clinicId)
      .then((resolvedClinicId) =>
        writeDataAccessLog(
          {
            accessorUserId: authResult.user.id,
            accessorRole: authResult.user.role,
            patientId,
            clinicId: resolvedClinicId,
            fieldsAccessed: sensitiveFields,
          },
          req
        )
      )
      .catch((err) =>
        req.log.error(
          { err, audit_failure: true, patientId },
          "LGPD audit write failed — resolveCallerClinicId rejected unexpectedly"
        )
      );
  }

  res.json(result);
});

router.patch("/patients/:patientId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const {
    name,
    email,
    dateOfBirth,
    targetWeight,
    avatarUrl,
    allergies,
    hasAllergies,
    medicalConditions,
    dietaryRestrictions,
    hasDietaryRestrictions,
    psychologyNotes,
    physicalActivityNotes,
    endocrinologyNotes,
    phone,
    cpf,
    rg,
    addressStreet,
    addressNumber,
    addressComplement,
    addressNeighborhood,
    addressCity,
    addressState,
    addressZip,
    paymentType,
    insuranceName,
  } = parsed.data;

  if (dateOfBirth) {
    const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth + "T00:00:00");
    if (dob.getTime() > Date.now()) {
      res.status(400).json({ error: "Data de nascimento não pode ser futura" });
      return;
    }
  }

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  let emailChanged = false;
  let emailToUpdate: string | undefined;
  if (normalizedEmail !== undefined) {
    const [patientUser] = await db
      .select({ id: usersTable.id, email: usersTable.email, clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.id, patient.userId))
      .limit(1);

    const currentPatientEmail = patientUser?.email.trim().toLowerCase();
    emailChanged = normalizedEmail !== currentPatientEmail;
    if (emailChanged) emailToUpdate = normalizedEmail;
    if (emailChanged && patientUser?.clerkId && !patientUser.clerkId.startsWith("manual_")) {
      res.status(409).json({
        error: "Este paciente usa login externo. Altere o e-mail pelo provedor de acesso para manter a conta sincronizada.",
      });
      return;
    }

    if (emailChanged) {
      const [emailConflict] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(sql`lower(${usersTable.email}) = ${normalizedEmail}`, ne(usersTable.id, patient.userId)))
        .limit(1);
      if (emailConflict) {
        res.status(409).json({ error: "Este e-mail já está cadastrado" });
        return;
      }
    }
  }

  // CPF uniqueness per clinic: reject if another patient in any of the same clinics already has this CPF
  if (cpf !== undefined && cpf !== null && cpf !== "") {
    const patientClinicRows = await db
      .select({ clinicId: patientClinicsTable.clinicId })
      .from(patientClinicsTable)
      .where(eq(patientClinicsTable.patientId, patientId));

    if (patientClinicRows.length > 0) {
      const clinicIds = patientClinicRows.map((r) => r.clinicId);
      const [cpfConflict] = await db
        .select({ id: patientsTable.id })
        .from(patientsTable)
        .innerJoin(patientClinicsTable, eq(patientClinicsTable.patientId, patientsTable.id))
        .where(
          and(
            eq(patientsTable.cpf, cpf),
            inArray(patientClinicsTable.clinicId, clinicIds),
            ne(patientsTable.id, patientId)
          )
        )
        .limit(1);
      if (cpfConflict) {
        res.status(409).json({ error: "CPF já cadastrado nesta clínica" });
        return;
      }
    }
  }

  if (name !== undefined || emailChanged || avatarUrl !== undefined) {
    try {
      await db
        .update(usersTable)
        .set({
          ...(name !== undefined ? { name } : {}),
          ...(emailToUpdate !== undefined ? { email: emailToUpdate } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        })
        .where(eq(usersTable.id, patient.userId));
    } catch (err: unknown) {
      if (emailChanged && typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
        res.status(409).json({ error: "Este e-mail já está cadastrado" });
        return;
      }
      throw err;
    }
  }

  const patientUpdates = {
    ...(targetWeight !== undefined ? { targetWeight: String(targetWeight) } : {}),
    ...(dateOfBirth ? { dateOfBirth: dateOfBirth instanceof Date ? dateOfBirth.toISOString().split("T")[0] : String(dateOfBirth) } : {}),
    ...(allergies !== undefined ? { allergies } : {}),
    ...(hasAllergies !== undefined ? { hasAllergies } : {}),
    ...(medicalConditions !== undefined ? { medicalConditions } : {}),
    ...(dietaryRestrictions !== undefined ? { dietaryRestrictions } : {}),
    ...(hasDietaryRestrictions !== undefined ? { hasDietaryRestrictions } : {}),
    ...(psychologyNotes !== undefined ? { psychologyNotes } : {}),
    ...(physicalActivityNotes !== undefined ? { physicalActivityNotes } : {}),
    ...(endocrinologyNotes !== undefined ? { endocrinologyNotes } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(cpf !== undefined ? { cpf } : {}),
    ...(rg !== undefined ? { rg } : {}),
    ...(addressStreet !== undefined ? { addressStreet } : {}),
    ...(addressNumber !== undefined ? { addressNumber } : {}),
    ...(addressComplement !== undefined ? { addressComplement } : {}),
    ...(addressNeighborhood !== undefined ? { addressNeighborhood } : {}),
    ...(addressCity !== undefined ? { addressCity } : {}),
    ...(addressState !== undefined ? { addressState } : {}),
    ...(addressZip !== undefined ? { addressZip } : {}),
    // Payment/insurance is internal admin data — only staff (doctor/clinic_owner/secretaria) may set it.
    ...(paymentType !== undefined && authResult.user.role !== "patient"
      ? { paymentType, insuranceName: paymentType === "convenio" ? (insuranceName ?? null) : null }
      : {}),
  };

  if (Object.keys(patientUpdates).length > 0) {
    try {
      await db.update(patientsTable).set(patientUpdates).where(eq(patientsTable.id, patientId));
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
        res.status(409).json({ error: "CPF já cadastrado nesta clínica" });
        return;
      }
      throw err;
    }
  }

  const rows = await db
    .select({ patient: patientsTable, user: usersTable })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(eq(patientsTable.id, patientId))
    .limit(1);

  const result = await buildPatientResponse({ ...rows[0].patient, user: rows[0].user }, authResult.user.role);
  res.json(result);
});

router.patch("/patients/:patientId/weight-goal", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Only patients can propose a weight goal" });
    return;
  }

  const parsed = ProposeWeightGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  await db
    .update(patientsTable)
    .set({
      proposedTargetWeight: String(parsed.data.targetWeight),
      weightGoalStatus: "pending",
      weightGoalValidatedByUserId: null,
      weightGoalValidatedAt: null,
    })
    .where(eq(patientsTable.id, patientId));

  const rows = await db
    .select({ patient: patientsTable, user: usersTable })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(eq(patientsTable.id, patientId))
    .limit(1);

  const result = await buildPatientResponse({ ...rows[0].patient, user: rows[0].user }, authResult.user.role);
  res.json(result);
});

router.post("/patients/:patientId/weight-goal/validate", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  if (authResult.user.role !== "profissional_saude" && authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only a health professional or clinic owner can validate a weight goal" });
    return;
  }

  const parsed = ValidateWeightGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  if (patient.weightGoalStatus !== "pending" || patient.proposedTargetWeight === null) {
    res.status(409).json({ error: "No pending weight goal to validate" });
    return;
  }

  const approve = parsed.data.action === "approve";

  await db
    .update(patientsTable)
    .set({
      ...(approve ? { targetWeight: patient.proposedTargetWeight } : {}),
      weightGoalStatus: approve ? "validated" : "rejected",
      weightGoalValidatedByUserId: authResult.user.id,
      weightGoalValidatedAt: new Date(),
    })
    .where(eq(patientsTable.id, patientId));

  const rows = await db
    .select({ patient: patientsTable, user: usersTable })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(eq(patientsTable.id, patientId))
    .limit(1);

  const result = await buildPatientResponse({ ...rows[0].patient, user: rows[0].user }, authResult.user.role);
  res.json(result);
});

router.get("/patients/:patientId/summary", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const p = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!p) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const checkIns = await db.select().from(checkInsTable).where(eq(checkInsTable.patientId, patientId));
  const latestWeight = await db
    .select()
    .from(weightEntriesTable)
    .where(eq(weightEntriesTable.patientId, patientId))
    .orderBy(desc(weightEntriesTable.date))
    .limit(1);

  const xpResult = await db
    .select({ total: sql<number>`coalesce(sum(${xpEntriesTable.points}), 0)` })
    .from(xpEntriesTable)
    .where(eq(xpEntriesTable.patientId, patientId));

  const totalXp = Number(xpResult[0]?.total ?? 0);
  const currentWeight = latestWeight[0] ? Number(latestWeight[0].weightKg) : null;
  const startWeight = Number(p.startWeight);
  const weightLostKg = currentWeight != null ? startWeight - currentWeight : 0;

  // Calculate streak (consecutive days with all 3 goals)
  const today = new Date();
  let streak = 0;
  const sortedCheckIns = [...checkIns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const ci of sortedCheckIns) {
    if (ci.didExercise && ci.drankWater && ci.ateWell) streak++;
    else break;
  }

  // Weekly goal rate
  const fullGoalDays = checkIns.filter((c) => c.didExercise && c.drankWater && c.ateWell).length;
  const weeklyGoalRate = checkIns.length > 0 ? (fullGoalDays / checkIns.length) * 100 : 0;

  const lastCheckIn = sortedCheckIns[0];

  res.json({
    patientId,
    totalXp,
    currentStreak: streak,
    weeklyGoalRate: Math.round(weeklyGoalRate),
    checkInCount: checkIns.length,
    weightLostKg: Math.max(0, weightLostKg),
    startWeight: Number(p.startWeight),
    currentWeight,
    targetWeight: p.targetWeight ? Number(p.targetWeight) : null,
    lastCheckInDate: lastCheckIn?.date ?? null,
  });
});

router.get("/patients/:patientId/doctors", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const accessible = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!accessible) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const assignments = await db
    .select({ doctor: doctorsTable, user: usersTable })
    .from(patientDoctorsTable)
    .innerJoin(doctorsTable, eq(doctorsTable.id, patientDoctorsTable.doctorId))
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(eq(patientDoctorsTable.patientId, patientId));

  const patientCounts = await db
    .select({
      doctorId: patientDoctorsTable.doctorId,
      count: sql<number>`count(*)`,
    })
    .from(patientDoctorsTable)
    .groupBy(patientDoctorsTable.doctorId);

  const countMap = new Map(patientCounts.map((r) => [r.doctorId, Number(r.count)]));

  res.json(
    assignments.map(({ doctor, user: u }) => ({
      id: doctor.id,
      userId: doctor.userId,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl ?? null,
      specialty: doctor.specialty,
      bio: doctor.bio ?? null,
      patientCount: countMap.get(doctor.id) ?? 0,
      createdAt: doctor.createdAt.toISOString(),
    }))
  );
});

router.post("/patients/:patientId/doctors", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can assign doctors" });
    return;
  }

  const parsed = AssignDoctorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);
  const { doctorId } = parsed.data;

  // Verify owner has access to this patient
  const patientRecord = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patientRecord) {
    res.status(403).json({ error: "Acesso negado ao paciente" });
    return;
  }

  // Verify the doctor belongs to the owner's clinic
  const ownerClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  const [docRecord] = await db
    .select({ clinicId: doctorsTable.clinicId })
    .from(doctorsTable)
    .where(eq(doctorsTable.id, doctorId))
    .limit(1);
  if (!docRecord || docRecord.clinicId !== ownerClinicId) {
    res.status(403).json({ error: "Médico não pertence a esta clínica" });
    return;
  }

  await db
    .insert(patientDoctorsTable)
    .values({ patientId, doctorId })
    .onConflictDoNothing();

  res.status(201).json({
    patientId,
    doctorId,
    createdAt: new Date().toISOString(),
  });
});

router.get("/patients/:patientId/nutrition-goals", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado ou sem permissão" });
    return;
  }

  res.json({
    patientId,
    dailyCalorieGoal: patient.dailyCalorieGoal ?? null,
    dailyWaterGoalMl: patient.dailyWaterGoalMl,
    dailyExerciseCalorieGoal: patient.dailyExerciseCalorieGoal,
    proteinGoalG: patient.proteinGoalG ?? null,
    carbGoalG: patient.carbGoalG ?? null,
    fatGoalG: patient.fatGoalG ?? null,
    mealsPerDay: patient.mealsPerDay ?? null,
    dietaryRestrictions: patient.dietaryRestrictions ?? null,
    nutritionNotes: patient.nutritionNotes ?? null,
  });
});

router.put("/patients/:patientId/nutrition-goals", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user } = authResult;
  const isStaff = user.role === "clinic_owner" || user.role === "profissional_saude";
  if (!isStaff && user.role !== "patient") {
    res.status(403).json({ error: "Apenas profissionais de saúde ou o próprio paciente podem definir metas nutricionais" });
    return;
  }

  const raw = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const patientId = parseInt(raw, 10);

  const patient = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado ou sem permissão" });
    return;
  }

  const parsed = UpdateNutritionGoalsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    dailyCalorieGoal,
    dailyWaterGoalMl,
    dailyExerciseCalorieGoal,
    proteinGoalG,
    carbGoalG,
    fatGoalG,
    mealsPerDay,
    dietaryRestrictions,
    nutritionNotes,
  } = parsed.data;

  // Patients may only self-adjust their own daily goals (calorie, water,
  // exercise calorie burn) — all other nutrition fields (macros, meals/day,
  // restrictions, notes) remain staff-only.
  if (!isStaff) {
    const attemptsOtherFields =
      proteinGoalG !== undefined ||
      carbGoalG !== undefined ||
      fatGoalG !== undefined ||
      mealsPerDay !== undefined ||
      dietaryRestrictions !== undefined ||
      nutritionNotes !== undefined;
    if (attemptsOtherFields) {
      res.status(403).json({ error: "Pacientes só podem ajustar suas próprias metas diárias (calorias, água e exercício); as demais metas são definidas pelo profissional de saúde" });
      return;
    }
  }

  const updateFields: Record<string, unknown> = {};
  if (dailyCalorieGoal !== undefined) updateFields.dailyCalorieGoal = dailyCalorieGoal ?? null;
  if (dailyWaterGoalMl !== undefined) updateFields.dailyWaterGoalMl = dailyWaterGoalMl;
  if (dailyExerciseCalorieGoal !== undefined) updateFields.dailyExerciseCalorieGoal = dailyExerciseCalorieGoal;
  if (isStaff) {
    if (proteinGoalG !== undefined) updateFields.proteinGoalG = proteinGoalG ?? null;
    if (carbGoalG !== undefined) updateFields.carbGoalG = carbGoalG ?? null;
    if (fatGoalG !== undefined) updateFields.fatGoalG = fatGoalG ?? null;
    if (mealsPerDay !== undefined) updateFields.mealsPerDay = mealsPerDay ?? null;
    if (dietaryRestrictions !== undefined) updateFields.dietaryRestrictions = dietaryRestrictions ?? null;
    if (nutritionNotes !== undefined) updateFields.nutritionNotes = nutritionNotes ?? null;
  }

  const [updated] = await db
    .update(patientsTable)
    .set(updateFields)
    .where(eq(patientsTable.id, patientId))
    .returning();

  res.json({
    patientId,
    dailyCalorieGoal: updated.dailyCalorieGoal ?? null,
    dailyWaterGoalMl: updated.dailyWaterGoalMl,
    dailyExerciseCalorieGoal: updated.dailyExerciseCalorieGoal,
    proteinGoalG: updated.proteinGoalG ?? null,
    carbGoalG: updated.carbGoalG ?? null,
    fatGoalG: updated.fatGoalG ?? null,
    mealsPerDay: updated.mealsPerDay ?? null,
    dietaryRestrictions: updated.dietaryRestrictions ?? null,
    nutritionNotes: updated.nutritionNotes ?? null,
  });
});

router.delete("/patients/:patientId/doctors/:doctorId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Only clinic owners can remove doctors" });
    return;
  }

  const rawP = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const rawD = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const patientId = parseInt(rawP, 10);
  const doctorId = parseInt(rawD, 10);

  // Verify owner can access this patient
  const patientRecord = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patientRecord) {
    res.status(403).json({ error: "Acesso negado ao paciente" });
    return;
  }

  // Verify the doctor belongs to the owner's clinic
  const ownerClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  const [docRecord] = await db
    .select({ clinicId: doctorsTable.clinicId })
    .from(doctorsTable)
    .where(eq(doctorsTable.id, doctorId))
    .limit(1);
  if (!docRecord || docRecord.clinicId !== ownerClinicId) {
    res.status(403).json({ error: "Médico não pertence a esta clínica" });
    return;
  }

  await db
    .delete(patientDoctorsTable)
    .where(
      sql`${patientDoctorsTable.patientId} = ${patientId} AND ${patientDoctorsTable.doctorId} = ${doctorId}`
    );

  res.status(204).send();
});

export default router;
