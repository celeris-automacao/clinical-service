import { eq, sql, and, isNotNull } from "drizzle-orm";
import { db, patientsTable, patientDoctorsTable, doctorsTable, usersTable, clinicSettingsTable } from "@workspace/db";
import { sendBirthdayNotificationEmail } from "./email";
import { logger } from "./logger";

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

async function fetchClinicBranding() {
  const [settings] = await db.select().from(clinicSettingsTable).limit(1);
  return {
    clinicName: settings?.clinicName ?? null,
    fromEmail: settings?.fromEmail ?? null,
    replyToEmail: settings?.replyToEmail ?? null,
  };
}

export async function runBirthdayNotifications(): Promise<void> {
  logger.info("Birthday job: checking for patients with birthdays today");

  const currentYear = new Date().getFullYear();

  try {
    const todayPatients = await db
      .select({ patient: patientsTable, user: usersTable })
      .from(patientsTable)
      .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
      .where(
        and(
          isNotNull(patientsTable.dateOfBirth),
          sql`EXTRACT(MONTH FROM ${patientsTable.dateOfBirth}) = EXTRACT(MONTH FROM CURRENT_DATE)`,
          sql`EXTRACT(DAY FROM ${patientsTable.dateOfBirth}) = EXTRACT(DAY FROM CURRENT_DATE)`,
          sql`(${patientsTable.lastBirthdayNotificationYear} IS NULL OR ${patientsTable.lastBirthdayNotificationYear} != ${currentYear})`
        )
      );

    if (todayPatients.length === 0) {
      logger.info("Birthday job: no patients with birthdays today (or all already notified this year)");
      return;
    }

    logger.info({ count: todayPatients.length }, "Birthday job: found patients with birthdays today");

    const branding = await fetchClinicBranding();

    for (const { patient, user: patientUser } of todayPatients) {
      if (!patient.dateOfBirth) continue;

      const age = calculateAge(patient.dateOfBirth);

      const assignedStaff = await db
        .select({ doctor: doctorsTable, user: usersTable })
        .from(patientDoctorsTable)
        .innerJoin(doctorsTable, eq(doctorsTable.id, patientDoctorsTable.doctorId))
        .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
        .where(eq(patientDoctorsTable.patientId, patient.id));

      if (assignedStaff.length === 0) {
        logger.info(
          { patientId: patient.id, patientName: patientUser.name },
          "Birthday job: patient has no assigned staff, skipping notifications"
        );
        continue;
      }

      let atLeastOneSent = false;
      for (const { user: staffUser } of assignedStaff) {
        try {
          await sendBirthdayNotificationEmail({
            to: staffUser.email,
            staffName: staffUser.name,
            patientName: patientUser.name,
            age,
            clinicName: branding.clinicName,
            fromEmail: branding.fromEmail,
            replyToEmail: branding.replyToEmail,
          });
          atLeastOneSent = true;
          logger.info(
            { staffEmail: staffUser.email, patientName: patientUser.name, age },
            "Birthday job: notification sent"
          );
        } catch (err) {
          logger.error(
            { err, staffEmail: staffUser.email, patientName: patientUser.name },
            "Birthday job: failed to send notification"
          );
        }
      }

      if (atLeastOneSent) {
        await db
          .update(patientsTable)
          .set({ lastBirthdayNotificationYear: currentYear })
          .where(eq(patientsTable.id, patient.id));
        logger.info(
          { patientId: patient.id, year: currentYear },
          "Birthday job: marked patient as notified for this year"
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Birthday job: unexpected error");
  }
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function startBirthdayJob(): void {
  logger.info("Birthday job: running initial check on startup");
  void runBirthdayNotifications();

  const delay = msUntilMidnight();
  const delayHours = Math.round((delay / 1000 / 60 / 60) * 10) / 10;
  logger.info({ delayHours }, "Birthday job: daily runs scheduled starting at next midnight");

  setTimeout(() => {
    void runBirthdayNotifications();
    setInterval(() => {
      void runBirthdayNotifications();
    }, 24 * 60 * 60 * 1000);
  }, delay);
}
