/**
 * Local-only fixtures: corepack pnpm --filter @workspace/scripts run seed:finance <clinicId> <AAAA-MM>
 * Creates three fictional doctors (30/40/50% commissions) and patients without login credentials.
 * Adds two paid, one unpaid and one cancelled consultation per doctor.
 * Existing fixtures and manual edits are preserved on reruns; no emails or real payments are sent.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, eq } from "drizzle-orm";
import {
  appointmentsTable,
  clinicsTable,
  doctorsTable,
  patientClinicsTable,
  patientDoctorsTable,
  patientsTable,
  usersTable,
} from "@workspace/db";

async function main() {
  const clinicId = Number(process.argv[2]);
  const period = process.argv[3];
  if (!Number.isSafeInteger(clinicId) || clinicId <= 0 || !period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error("Uso: seed:finance <clinicId> <AAAA-MM>");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(connectionString).hostname)) {
    throw new Error("Este seed aceita somente DATABASE_URL de um banco local.");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  try {
    await db.transaction(async (tx) => {
      const [clinic] = await tx.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
      if (!clinic) throw new Error("Clinica nao encontrada.");

      for (let index = 1; index <= 3; index++) {
        const suffix = `${clinicId}-${index}@finance-test.invalid`;
        const doctorEmail = `doctor-${suffix}`;
        const patientEmail = `patient-${suffix}`;
        const [doctorUser] = await tx.insert(usersTable).values({
          email: doctorEmail,
          name: `Medico Teste Financeiro ${index}`,
          role: "profissional_saude",
        }).onConflictDoNothing({ target: usersTable.email }).returning();
        const existingDoctorUser = doctorUser ?? (await tx.select().from(usersTable).where(eq(usersTable.email, doctorEmail)))[0];
        if (!existingDoctorUser || existingDoctorUser.role !== "profissional_saude") {
          throw new Error(`Usuario de teste conflitante: ${doctorEmail}`);
        }
        let [doctor] = await tx.select().from(doctorsTable).where(and(
          eq(doctorsTable.userId, existingDoctorUser.id),
          eq(doctorsTable.clinicId, clinicId),
        ));
        if (!doctor) {
          [doctor] = await tx.insert(doctorsTable).values({
            userId: existingDoctorUser.id,
            clinicId,
            specialty: "Clinica geral",
            consultationPrice: "200.00",
            commissionPercent: String(20 + index * 10),
            showOnPublicPage: false,
          }).returning();
        }
        if (!doctor) throw new Error("Falha ao criar medico de teste.");

        const [patientUser] = await tx.insert(usersTable).values({
          email: patientEmail,
          name: `Paciente Teste Financeiro ${index}`,
          role: "patient",
        }).onConflictDoNothing({ target: usersTable.email }).returning();
        const existingPatientUser = patientUser ?? (await tx.select().from(usersTable).where(eq(usersTable.email, patientEmail)))[0];
        if (!existingPatientUser || existingPatientUser.role !== "patient") {
          throw new Error(`Usuario de teste conflitante: ${patientEmail}`);
        }
        let [patient] = await tx.select().from(patientsTable).where(eq(patientsTable.userId, existingPatientUser.id));
        if (patient && patient.clinicId !== clinicId) throw new Error("Paciente de teste vinculado a outra clinica.");
        if (!patient) {
          [patient] = await tx.insert(patientsTable).values({
            userId: existingPatientUser.id,
            clinicId,
            startWeight: "70.00",
            paymentType: index === 2 ? "convenio" : "particular",
            insuranceName: index === 2 ? "Convenio Teste Financeiro" : null,
          }).returning();
        }
        if (!patient) throw new Error("Falha ao criar paciente de teste.");
        await tx.insert(patientClinicsTable).values({ patientId: patient.id, clinicId }).onConflictDoNothing();
        const [link] = await tx.select().from(patientDoctorsTable).where(and(
          eq(patientDoctorsTable.patientId, patient.id),
          eq(patientDoctorsTable.doctorId, doctor.id),
        ));
        if (!link) await tx.insert(patientDoctorsTable).values({ patientId: patient.id, doctorId: doctor.id });

        const cases = [
          { day: "05", amount: "200.00", isPaid: true, status: "completed", paymentMethod: "pix" },
          { day: "10", amount: "300.00", isPaid: true, status: "completed", paymentMethod: "cartao" },
          { day: "15", amount: "150.00", isPaid: false, status: "completed", paymentMethod: null },
          { day: "20", amount: "900.00", isPaid: false, status: "cancelled", paymentMethod: null },
        ] as const;
        for (const testCase of cases) {
          await tx.insert(appointmentsTable).values({
            clinicId,
            doctorId: doctor.id,
            patientId: patient.id,
            date: `${period}-${testCase.day}`,
            startTime: "09:00",
            endTime: "09:30",
            amountCharged: testCase.amount,
            isPaid: testCase.isPaid,
            paymentMethod: testCase.paymentMethod,
            status: testCase.status,
            paymentNotes: "TESTE FINANCEIRO: dados ficticios, sem transacao real.",
            paymentRecordedAt: testCase.isPaid ? new Date(`${period}-${testCase.day}T12:00:00Z`) : null,
            cancelReason: testCase.status === "cancelled" ? "TESTE FINANCEIRO: excluir dos totais." : null,
          }).onConflictDoNothing({
            target: [appointmentsTable.doctorId, appointmentsTable.date, appointmentsTable.startTime],
          });
        }
      }
    });
    console.log(`Seed financeiro concluido: clinica ${clinicId}, periodo ${period}.`);
    console.log("Na primeira execucao: 12 consultas, R$ 1.500 pagos, R$ 450 pendentes.");
    console.log("Comissoes de teste: R$ 150 (30%), R$ 200 (40%), R$ 250 (50%).");
    console.log("Reexecucoes preservam os registros existentes, inclusive edicoes manuais.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Falha no seed financeiro:", error);
  process.exitCode = 1;
});
