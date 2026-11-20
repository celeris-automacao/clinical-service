import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, appointmentsTable, patientsTable, doctorsTable, usersTable, clinicsTable } from "@workspace/db";
import { sendAppointmentConfirmationEmail } from "./email";
import { createAppointmentConfirmationToken } from "./appointmentConfirmation";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const REMINDER_LEAD_HOURS = 24;
const patientUsersTable = alias(usersTable, "appointment_confirmation_patient");
const doctorUsersTable = alias(usersTable, "appointment_confirmation_doctor");

/**
 * Sends patients an email asking them to confirm scheduled appointments about
 * 24 hours in advance. A clinic may cancel an unconfirmed appointment manually;
 * this job never cancels appointments automatically.
 */
export async function runAppointmentReminderJob(): Promise<void> {
  logger.info("Appointment confirmation job: checking for due appointments");

  try {
    const due = await db
      .select({
        appointment: appointmentsTable,
        patientEmail: patientUsersTable.email,
        patientName: patientUsersTable.name,
        doctorName: doctorUsersTable.name,
        clinicName: clinicsTable.name,
      })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(patientsTable.id, appointmentsTable.patientId))
      .innerJoin(patientUsersTable, eq(patientUsersTable.id, patientsTable.userId))
      .innerJoin(doctorsTable, eq(doctorsTable.id, appointmentsTable.doctorId))
      .innerJoin(doctorUsersTable, eq(doctorUsersTable.id, doctorsTable.userId))
      .innerJoin(clinicsTable, eq(clinicsTable.id, appointmentsTable.clinicId))
      .where(
        and(
          eq(appointmentsTable.status, "scheduled"),
          isNull(appointmentsTable.confirmationSentAt),
          isNull(appointmentsTable.confirmationTokenHash),
          isNull(appointmentsTable.confirmedAt),
          lte(
            sql`(${appointmentsTable.date}::date + ${appointmentsTable.startTime}::time) - interval '${sql.raw(String(REMINDER_LEAD_HOURS))} hours'`,
            sql`now()`
          ),
          sql`(${appointmentsTable.date}::date + ${appointmentsTable.startTime}::time) > now()`
        )
      );

    if (due.length === 0) {
      logger.info("Appointment confirmation job: no due appointments");
      return;
    }

    logger.info({ count: due.length }, "Appointment confirmation job: found due appointments");

    for (const row of due) {
      const { appointment } = row;
      const { token, tokenHash } = createAppointmentConfirmationToken();
      const [claimed] = await db
        .update(appointmentsTable)
        .set({ confirmationTokenHash: tokenHash })
        .where(
          and(
            eq(appointmentsTable.id, appointment.id),
            isNull(appointmentsTable.confirmationSentAt),
            isNull(appointmentsTable.confirmationTokenHash),
            isNull(appointmentsTable.confirmedAt)
          )
        )
        .returning({ id: appointmentsTable.id });

      if (!claimed) continue;

      try {
        const sent = await sendAppointmentConfirmationEmail({
          to: row.patientEmail,
          patientName: row.patientName,
          doctorName: row.doctorName,
          clinicName: row.clinicName,
          date: appointment.date,
          startTime: appointment.startTime,
          confirmationUrl: `/api/appointments/confirm?token=${encodeURIComponent(token)}`,
          appointmentId: appointment.id,
        });

        if (!sent) {
          await db
            .update(appointmentsTable)
            .set({ confirmationTokenHash: null })
            .where(and(eq(appointmentsTable.id, appointment.id), eq(appointmentsTable.confirmationTokenHash, tokenHash)));
          continue;
        }

        await db
          .update(appointmentsTable)
          .set({ confirmationSentAt: new Date() })
          .where(and(eq(appointmentsTable.id, appointment.id), eq(appointmentsTable.confirmationTokenHash, tokenHash)));
        logger.info({ appointmentId: appointment.id }, "Appointment confirmation email sent");
      } catch (err) {
        await db
          .update(appointmentsTable)
          .set({ confirmationTokenHash: null })
          .where(and(eq(appointmentsTable.id, appointment.id), eq(appointmentsTable.confirmationTokenHash, tokenHash)));
        logger.warn({ err, appointmentId: appointment.id }, "Appointment confirmation email failed; will retry");
      }
    }
  } catch (err) {
    logger.error({ err }, "Appointment confirmation job: unexpected error");
  }
}

export function startAppointmentReminderJob(): void {
  logger.info("Appointment confirmation job: running initial check on startup");
  void runAppointmentReminderJob();

  setInterval(() => {
    void runAppointmentReminderJob();
  }, CHECK_INTERVAL_MS);

  logger.info({ intervalMinutes: CHECK_INTERVAL_MS / 60000 }, "Appointment confirmation job: scheduled recurring checks");
}
