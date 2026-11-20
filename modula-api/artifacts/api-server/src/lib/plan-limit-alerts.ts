import { eq } from "drizzle-orm";
import {
  db,
  clinicSettingsTable,
  clinicOwnersTable,
  usersTable,
  staffEventsTable,
  PLAN_DOCTOR_LIMITS,
  PLAN_LABELS,
} from "@workspace/db";
import { sendPlanLimitAlertEmail } from "./email";
import { logger } from "./logger";

type Threshold = "90" | "100";

function resolveThreshold(doctorCount: number, limit: number): Threshold | null {
  if (!isFinite(limit) || limit <= 0) return null;
  const pct = doctorCount / limit;
  if (pct >= 1) return "100";
  if (pct >= 0.9) return "90";
  return null;
}

/**
 * Called after a doctor is successfully created for a clinic. Checks whether
 * the clinic just crossed the 90% or 100% plan-doctor-limit threshold for the
 * first time this "cycle" (i.e. since the last time the threshold was reset
 * by a plan change), and if so, logs a staff event and emails the clinic
 * owner(s). Never throws — failures are logged and swallowed so they cannot
 * break the doctor-creation flow.
 */
export async function checkAndFirePlanLimitAlert(clinicId: number, doctorCount: number): Promise<void> {
  try {
    const [settingsRow] = await db
      .select()
      .from(clinicSettingsTable)
      .where(eq(clinicSettingsTable.clinicId, clinicId))
      .limit(1);
    if (!settingsRow) return;

    const limit = PLAN_DOCTOR_LIMITS[settingsRow.plan] ?? 2;
    const newThreshold = resolveThreshold(doctorCount, limit);
    if (!newThreshold) return;

    const alreadyNotified = settingsRow.lastPlanLimitAlert;
    // Already notified at this threshold, or already notified the higher one.
    if (alreadyNotified === newThreshold || (alreadyNotified === "100" && newThreshold === "90")) {
      return;
    }

    await db
      .update(clinicSettingsTable)
      .set({ lastPlanLimitAlert: newThreshold })
      .where(eq(clinicSettingsTable.clinicId, clinicId));

    const owners = await db
      .select({ userId: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(clinicOwnersTable)
      .innerJoin(usersTable, eq(usersTable.id, clinicOwnersTable.userId))
      .where(eq(clinicOwnersTable.clinicId, clinicId));

    const planLabel = PLAN_LABELS[settingsRow.plan] ?? settingsRow.plan;
    const description =
      newThreshold === "100"
        ? `Limite de profissionais do plano ${planLabel} atingido (${doctorCount}/${limit}). Faça upgrade para cadastrar mais profissionais.`
        : `Clínica próxima do limite de profissionais do plano ${planLabel} (${doctorCount}/${limit}).`;

    if (owners.length > 0) {
      await db.insert(staffEventsTable).values({
        userId: owners[0].userId,
        clinicId,
        type: newThreshold === "100" ? "plan_limit_reached" : "plan_limit_warning",
        description,
      });
    }

    for (const owner of owners) {
      try {
        await sendPlanLimitAlertEmail({
          to: owner.email,
          ownerName: owner.name,
          threshold: newThreshold,
          planLabel,
          doctorCount,
          doctorLimit: limit,
          clinicName: settingsRow.clinicName,
          fromEmail: settingsRow.fromEmail,
          replyToEmail: settingsRow.replyToEmail,
        });
      } catch (err) {
        logger.error({ err, clinicId, ownerEmail: owner.email }, "Failed to send plan limit alert email");
      }
    }
  } catch (err) {
    logger.error({ err, clinicId, doctorCount }, "Failed to check/fire plan limit alert");
  }
}

/**
 * Called after a doctor is removed/deactivated for a clinic. If the clinic's
 * usage has dropped back below the threshold that was last alerted on, clears
 * the dedupe marker so a future re-crossing of that threshold fires a fresh
 * alert (rather than staying silently suppressed forever). Never throws.
 */
export async function reconcilePlanLimitAlertOnDecrease(clinicId: number, doctorCount: number): Promise<void> {
  try {
    const [settingsRow] = await db
      .select()
      .from(clinicSettingsTable)
      .where(eq(clinicSettingsTable.clinicId, clinicId))
      .limit(1);
    if (!settingsRow || !settingsRow.lastPlanLimitAlert) return;

    const limit = PLAN_DOCTOR_LIMITS[settingsRow.plan] ?? 2;
    const currentThreshold = resolveThreshold(doctorCount, limit);

    if (currentThreshold === settingsRow.lastPlanLimitAlert) return;
    if (currentThreshold === "90" && settingsRow.lastPlanLimitAlert === "100") {
      await db
        .update(clinicSettingsTable)
        .set({ lastPlanLimitAlert: "90" })
        .where(eq(clinicSettingsTable.clinicId, clinicId));
      return;
    }
    if (currentThreshold === null) {
      await db
        .update(clinicSettingsTable)
        .set({ lastPlanLimitAlert: null })
        .where(eq(clinicSettingsTable.clinicId, clinicId));
    }
  } catch (err) {
    logger.error({ err, clinicId, doctorCount }, "Failed to reconcile plan limit alert state on decrease");
  }
}
