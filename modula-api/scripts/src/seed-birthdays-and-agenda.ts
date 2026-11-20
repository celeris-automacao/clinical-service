/**
 * One-off test-data script: adds patients with birthdays this month and fills
 * a full appointment agenda (availability + booked slots) for the clinic's
 * health professionals throughout the current month.
 *
 * Idempotent-ish: safe to re-run — it clears/replaces availability + this
 * month's appointments for the doctors it touches before recreating them, and
 * upserts birthday patients by email.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import {
  usersTable,
  patientsTable,
  doctorsTable,
  patientClinicsTable,
  patientDoctorsTable,
  clinicsTable,
  professionalAvailabilityTable,
  appointmentsTable,
  appointmentReviewsTable,
} from "@workspace/db";
import { migrateDb } from "@workspace/db/migrate";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const PASSWORD = "123456";
const SEED_MARKER = "seed_";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type Weekday = (typeof WEEKDAYS)[number];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function isoDate(year: number, month1to12: number, day: number): string {
  return `${year}-${pad(month1to12)}-${pad(day)}`;
}

function weekdayOf(year: number, month1to12: number, day: number): Weekday {
  const d = new Date(Date.UTC(year, month1to12 - 1, day));
  return WEEKDAYS[d.getUTCDay()];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

async function main() {
  console.log("=== Seed: aniversariantes do mês + agenda cheia dos profissionais ===\n");

  console.log("Aplicando migrações pendentes...");
  await migrateDb();
  console.log("Migrações OK.\n");

  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1; // 1-12
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const todayIso = isoDate(year, month, today.getUTCDate());

  console.log(`Mês de referência: ${pad(month)}/${year} (${daysInMonth} dias). Hoje: ${todayIso}\n`);

  const [klieClinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.name, "KLIE")).limit(1);
  if (!klieClinic) {
    throw new Error("Clínica KLIE não encontrada — rode o seed principal primeiro (pnpm --filter @workspace/scripts run seed).");
  }

  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── 1. Aniversariantes do mês ────────────────────────────────────────────
  console.log("Criando/atualizando aniversariantes deste mês...");

  type BirthdayPatientSpec = {
    email: string;
    name: string;
    day: number;
    startWeight: string;
    targetWeight: string;
  };

  const birthdaySpecs: BirthdayPatientSpec[] = [
    { email: "ana@paciente.dev", name: "Ana Beatriz Costa", day: today.getUTCDate(), startWeight: "92.5", targetWeight: "72.0" },
    { email: "claudia@paciente.dev", name: "Cláudia Martins", day: Math.min(daysInMonth, today.getUTCDate() + 7), startWeight: "78.3", targetWeight: "65.0" },
    { email: "eng.nayara@gmail.com", name: "Nayara de Souza", day: Math.min(daysInMonth, today.getUTCDate() + 20), startWeight: "85.0", targetWeight: "68.0" },
    { email: "fernanda.aniversariante@paciente.dev", name: "Fernanda Lima", day: Math.max(1, today.getUTCDate() - 2), startWeight: "80.0", targetWeight: "66.0" },
    { email: "rafael.aniversariante@paciente.dev", name: "Rafael Santos", day: Math.min(daysInMonth, today.getUTCDate() + 12), startWeight: "97.0", targetWeight: "82.0" },
  ];
  // bruno@paciente.dev already has a July 22 birthday from the base seed — leave as-is if it falls this month.

  const birthdayPatientIds: number[] = [];
  for (const spec of birthdaySpecs) {
    const dob = isoDate(year, month, spec.day);
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, spec.email)).limit(1);

    let userId: number;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const [newUser] = await db
        .insert(usersTable)
        .values({
          clerkId: `${SEED_MARKER}bday_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          email: spec.email,
          name: spec.name,
          role: "patient",
          passwordHash: hash,
          isTemporaryPassword: false,
        })
        .returning();
      userId = newUser!.id;
    }

    const [existingPatient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, userId)).limit(1);
    let patientId: number;
    if (existingPatient) {
      await db
        .update(patientsTable)
        .set({ dateOfBirth: dob, lastBirthdayNotificationYear: null })
        .where(eq(patientsTable.id, existingPatient.id));
      patientId = existingPatient.id;
    } else {
      const [newPatient] = await db
        .insert(patientsTable)
        .values({ userId, startWeight: spec.startWeight, targetWeight: spec.targetWeight, dateOfBirth: dob })
        .returning();
      patientId = newPatient!.id;
    }

    const [enrollment] = await db
      .select()
      .from(patientClinicsTable)
      .where(and(eq(patientClinicsTable.patientId, patientId), eq(patientClinicsTable.clinicId, klieClinic.id)))
      .limit(1);
    if (!enrollment) {
      await db.insert(patientClinicsTable).values({ patientId, clinicId: klieClinic.id });
    }

    birthdayPatientIds.push(patientId);
    console.log(`  ${spec.name} (${spec.email}) — aniversário em ${dob}`);
  }

  // ── 2. Todos os pacientes ativos da clínica KLIE ─────────────────────────
  const clinicPatientRows = await db
    .select({ patientId: patientClinicsTable.patientId })
    .from(patientClinicsTable)
    .where(eq(patientClinicsTable.clinicId, klieClinic.id));
  const allPatientIds = [...new Set(clinicPatientRows.map((r) => r.patientId))];
  console.log(`\nTotal de pacientes na clínica KLIE: ${allPatientIds.length}\n`);

  // ── 3. Agenda (disponibilidade) dos profissionais ────────────────────────
  console.log("Configurando disponibilidade dos profissionais...");
  const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.clinicId, klieClinic.id));

  const WORK_WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const WINDOWS = [
    { startTime: "08:00", endTime: "12:00" },
    { startTime: "14:00", endTime: "18:00" },
  ];
  const SLOT_MINUTES = 60;

  for (const doctor of doctors) {
    await db.delete(professionalAvailabilityTable).where(eq(professionalAvailabilityTable.doctorId, doctor.id));
    const rows = WORK_WEEKDAYS.flatMap((dayOfWeek) =>
      WINDOWS.map((w) => ({
        doctorId: doctor.id,
        dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
        slotDurationMinutes: SLOT_MINUTES,
      }))
    );
    await db.insert(professionalAvailabilityTable).values(rows);
  }
  console.log(`  Disponibilidade definida (seg-sex, 08-12h e 14-18h) para ${doctors.length} profissionais.\n`);

  // ── 4. Preencher a agenda do mês inteiro com consultas ───────────────────
  console.log("Preenchendo a agenda do mês com consultas...");

  // Clear this month's appointments for these doctors before recreating, so re-runs stay idempotent.
  const monthStart = isoDate(year, month, 1);
  const monthEnd = isoDate(year, month, daysInMonth);
  const doctorIds = doctors.map((d) => d.id);
  if (doctorIds.length > 0) {
    const existingApptIds = await db
      .select({ id: appointmentsTable.id })
      .from(appointmentsTable)
      .where(
        and(inArray(appointmentsTable.doctorId, doctorIds), gte(appointmentsTable.date, monthStart), lte(appointmentsTable.date, monthEnd))
      );
    if (existingApptIds.length > 0) {
      await db.delete(appointmentReviewsTable).where(
        inArray(appointmentReviewsTable.appointmentId, existingApptIds.map((a) => a.id))
      );
      await db.delete(appointmentsTable).where(
        inArray(appointmentsTable.id, existingApptIds.map((a) => a.id))
      );
    }
  }

  // Track which patient/date/startTime combos are already used so the same patient
  // never appears twice at the same date+time across different doctors.
  const usedPatientSlot = new Set<string>();
  let patientRotationCounter = 0;

  function nextAvailablePatient(date: string, startTime: string): number {
    for (let attempt = 0; attempt < allPatientIds.length; attempt++) {
      const candidate = allPatientIds[(patientRotationCounter + attempt) % allPatientIds.length]!;
      const key = `${candidate}|${date}|${startTime}`;
      if (!usedPatientSlot.has(key)) {
        usedPatientSlot.add(key);
        patientRotationCounter++;
        return candidate;
      }
    }
    // Fallback: all patients already booked at this exact date+time somewhere else — just reuse one.
    const fallback = allPatientIds[patientRotationCounter % allPatientIds.length]!;
    patientRotationCounter++;
    return fallback;
  }

  const REVIEW_COMMENTS = [
    "Consulta muito produtiva, obrigado(a)!",
    "Excelente atendimento, super atenciosa(o).",
    "Ajudou bastante a entender meu progresso.",
    "Ótimas orientações, já estou vendo resultado.",
    null,
    null,
  ];

  let createdCount = 0;
  let reviewCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = isoDate(year, month, day);
    const weekday = weekdayOf(year, month, day);
    if (!WORK_WEEKDAYS.includes(weekday)) continue;
    const isPast = dateIso < todayIso;

    for (const doctor of doctors) {
      for (const w of WINDOWS) {
        const start = timeToMinutes(w.startTime);
        const end = timeToMinutes(w.endTime);
        for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
          const startTime = minutesToTime(t);
          const endTime = minutesToTime(t + SLOT_MINUTES);
          const patientId = nextAvailablePatient(dateIso, startTime);
          const status: "scheduled" | "completed" = isPast ? "completed" : "scheduled";

          const [appt] = await db
            .insert(appointmentsTable)
            .values({
              patientId,
              doctorId: doctor.id,
              clinicId: klieClinic.id,
              date: dateIso,
              startTime,
              endTime,
              status,
            })
            .returning();
          createdCount++;

          if (isPast && Math.random() < 0.5) {
            const rating = 3 + Math.floor(Math.random() * 3); // 3-5
            const comment = REVIEW_COMMENTS[Math.floor(Math.random() * REVIEW_COMMENTS.length)] ?? null;
            await db.insert(appointmentReviewsTable).values({
              appointmentId: appt!.id,
              patientId,
              doctorId: doctor.id,
              rating,
              comment,
            });
            reviewCount++;
          }
        }
      }
    }
  }

  console.log(`  ${createdCount} consultas criadas (${daysInMonth} dias, ${doctors.length} profissionais).`);
  console.log(`  ${reviewCount} avaliações criadas para consultas concluídas.\n`);

  console.log("=== Concluído! ===\n");
  console.log("Aniversariantes deste mês (login: senha " + PASSWORD + "):");
  for (const spec of birthdaySpecs) {
    console.log(`  ${spec.email} — ${spec.name}`);
  }
  console.log("\nAgenda cheia criada para:");
  for (const doctor of doctors) {
    console.log(`  doctorId=${doctor.id}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
