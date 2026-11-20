import { and, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";
import {
  db,
  usersTable,
  patientsTable,
  clinicSettingsTable,
  staffEventsTable,
} from "@workspace/db";
import { hashPassword } from "./jwt";
import { sendTempPasswordEmail } from "./email";
import { sendExpoPushNotifications } from "./expoPush";
import { logger } from "./logger";

/** How often the job re-checks for expiring temporary passwords. */
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/** Resend a new code when the temporary password expires within this window. */
const RESEND_LEAD_HOURS = 2;

/**
 * Background job that proactively resends a fresh access code to patients whose
 * temporary password is about to expire (within the next 2 hours) and who have
 * not yet set a permanent password.
 *
 * On each run it:
 *  1. Finds patients with `isTemporaryPassword=true` expiring in the next 2 hours.
 *  2. Generates a new 6-digit code, updates the DB (new 24h window).
 *  3. Sends the new code by email.
 *  4. Sends a push notification if the patient has a registered push token.
 *  5. Records an activity-feed event so clinic staff can see the auto-resend.
 *
 * Idempotent by design: once the code is refreshed the expiry moves to +24h,
 * so the same patient will not be picked up again on the next run.
 */
export async function runTempPasswordExpiryJob(): Promise<void> {
  logger.info("Temp-password expiry job: checking for expiring codes");

  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() + RESEND_LEAD_HOURS * 60 * 60 * 1000);

    const expiring = await db
      .select({
        user: usersTable,
        pushToken: patientsTable.pushToken,
        clinicId: patientsTable.clinicId,
      })
      .from(usersTable)
      .innerJoin(patientsTable, eq(patientsTable.userId, usersTable.id))
      .where(
        and(
          eq(usersTable.role, "patient"),
          eq(usersTable.isTemporaryPassword, true),
          isNotNull(usersTable.temporaryPasswordExpiresAt),
          isNull(usersTable.deactivatedAt),
          // Not already expired
          gt(usersTable.temporaryPasswordExpiresAt, now),
          // Expires within the lead window
          lte(usersTable.temporaryPasswordExpiresAt, cutoff),
        ),
      );

    if (expiring.length === 0) {
      logger.info("Temp-password expiry job: no expiring codes found");
      return;
    }

    logger.info({ count: expiring.length }, "Temp-password expiry job: found expiring codes");

    for (const row of expiring) {
      const { user, pushToken, clinicId } = row;

      // Generate a fresh 6-digit numeric code
      const tempPassword = String(Math.floor(100000 + Math.random() * 900000));
      const passwordHash = await hashPassword(tempPassword);
      const temporaryPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db
        .update(usersTable)
        .set({ passwordHash, isTemporaryPassword: true, temporaryPasswordExpiresAt })
        .where(eq(usersTable.id, user.id));

      // Send email with the new code
      try {
        const [clinicSettings] = await db.select().from(clinicSettingsTable).limit(1);
        await sendTempPasswordEmail({
          to: user.email,
          name: user.name,
          tempPassword,
          clinicName: clinicSettings?.clinicName ?? null,
          senderName: clinicSettings?.senderName ?? null,
          fromEmail: clinicSettings?.fromEmail ?? null,
          replyToEmail: clinicSettings?.replyToEmail ?? null,
        });
        logger.info(
          { userId: user.id, email: user.email },
          "Temp-password expiry job: new access code emailed",
        );
      } catch (err) {
        logger.error(
          { err, userId: user.id },
          "Temp-password expiry job: failed to send email — DEV FALLBACK password logged below",
        );
        logger.info(
          { email: user.email, tempPassword },
          "DEV: temp password (email not sent)",
        );
      }

      // Push notification if the patient has a registered token
      if (pushToken) {
        const pushed = await sendExpoPushNotifications([
          {
            to: pushToken,
            title: "Novo código de acesso",
            body: `Seu código anterior estava prestes a expirar. Seu novo código é: ${tempPassword}`,
            data: { navigate: "/" },
          },
        ]);
        if (pushed) {
          logger.info(
            { userId: user.id },
            "Temp-password expiry job: push notification sent",
          );
        } else {
          logger.warn(
            { userId: user.id },
            "Temp-password expiry job: push notification failed",
          );
        }
      }

      // Activity-feed event so clinic staff can see the auto-resend
      await db.insert(staffEventsTable).values({
        userId: user.id,
        clinicId: clinicId ?? undefined,
        type: "access_code_auto_resent",
        description: `Novo código de acesso enviado automaticamente para ${user.name} (código anterior estava prestes a expirar).`,
      });
    }
  } catch (err) {
    logger.error({ err }, "Temp-password expiry job: unexpected error");
  }
}

export function startTempPasswordExpiryJob(): void {
  logger.info("Temp-password expiry job: running initial check on startup");
  void runTempPasswordExpiryJob();

  setInterval(() => {
    void runTempPasswordExpiryJob();
  }, CHECK_INTERVAL_MS);

  logger.info(
    { intervalMinutes: CHECK_INTERVAL_MS / 60000 },
    "Temp-password expiry job: scheduled recurring checks",
  );
}
