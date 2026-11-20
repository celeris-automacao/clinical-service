/**
 * Seed script — test data only.
 *
 * ⚠️  WARNING: The emails below are reserved exclusively for seeding.
 *     DO NOT create real accounts with these addresses:
 *       carlos@gmail.com, maria@gmail.com, eng.nayara@gmail.com,
 *       ligia@clinica.dev, carla@clinica.dev, paula@clinica.dev,
 *       admin@clinica.dev, ana@paciente.dev, bruno@paciente.dev,
 *       claudia@paciente.dev, secretaria@gmail.com
 *     If a real user registers with one of these emails the seed cleanup
 *     will delete their data on the next run.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { inArray, eq } from "drizzle-orm";
import {
  usersTable,
  patientsTable,
  doctorsTable,
  patientDoctorsTable,
  secretariesTable,
  checkInsTable,
  weightEntriesTable,
  xpEntriesTable,
  patientMaterialsTable,
  aiPatientSummariesTable,
  clinicsTable,
  patientClinicsTable,
  clinicOwnersTable,
  clinicSettingsTable,
  goalsTable,
  goalProgressTable,
  formsTable,
  formQuestionsTable,
  formAssignmentsTable,
} from "@workspace/db";
import { migrateDb } from "@workspace/db/migrate";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const PASSWORD = "123456";
const SEED_MARKER = "seed_";

async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function cleanSeedData() {
  console.log("Limpando dados de seed anteriores...");

  const seedEmails = [
    "carlos@gmail.com",
    "maria@gmail.com",
    "ligia@clinica.dev",
    "carla@clinica.dev",
    "paula@clinica.dev",
    "admin@clinica.dev",
    "ana@paciente.dev",
    "bruno@paciente.dev",
    "claudia@paciente.dev",
    "eng.nayara@gmail.com",
    "roberto@vitalis.dev",
    "fernanda@vitalis.dev",
    "juliano@vitalis.dev",
    "marcelo@paciente.dev",
    "patricia@paciente.dev",
    "diego@paciente.dev",
    "secretaria@gmail.com",
  ];

  const existingUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.email, seedEmails));

  if (existingUsers.length === 0) {
    console.log("Nenhum dado de seed encontrado. Prosseguindo com inserção...");
    // Clean up seed clinics if they exist (from a previous partial seed).
    // Must clean child tables referencing clinics before deleting the clinics.
    const orphanClinics = await db
      .select({ id: clinicsTable.id })
      .from(clinicsTable)
      .where(inArray(clinicsTable.name, ["KLIE", "Vitalis Saúde"]));
    const orphanClinicIds = orphanClinics.map((c) => c.id);
    if (orphanClinicIds.length > 0) {
      await db.delete(secretariesTable).where(inArray(secretariesTable.clinicId, orphanClinicIds));
      const orphanForms = await db
        .select({ id: formsTable.id })
        .from(formsTable)
        .where(inArray(formsTable.clinicId, orphanClinicIds));
      const orphanFormIds = orphanForms.map((f) => f.id);
      if (orphanFormIds.length > 0) {
        await db.delete(formAssignmentsTable).where(inArray(formAssignmentsTable.formId, orphanFormIds));
        await db.delete(formQuestionsTable).where(inArray(formQuestionsTable.formId, orphanFormIds));
        await db.delete(formsTable).where(inArray(formsTable.id, orphanFormIds));
      }
      await db.delete(clinicsTable).where(inArray(clinicsTable.id, orphanClinicIds));
    }
    return;
  }

  const userIds = existingUsers.map((u) => u.id);

  const existingPatients = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(inArray(patientsTable.userId, userIds));
  const patientIds = existingPatients.map((p) => p.id);

  const existingDoctors = await db
    .select({ id: doctorsTable.id })
    .from(doctorsTable)
    .where(inArray(doctorsTable.userId, userIds));
  const doctorIds = existingDoctors.map((d) => d.id);

  // Resolve seed clinic IDs early — needed for cascade-safe cleanup of tables
  // that use clinicId FK (secretaries, forms, etc.)
  const seedClinics = await db
    .select({ id: clinicsTable.id })
    .from(clinicsTable)
    .where(inArray(clinicsTable.name, ["KLIE", "Vitalis Saúde"]));
  const seedClinicIds = seedClinics.map((c) => c.id);

  // Delete ALL secretaries for seed clinics (not just by userId) to avoid FK conflicts
  if (seedClinicIds.length > 0) {
    await db.delete(secretariesTable).where(inArray(secretariesTable.clinicId, seedClinicIds));
  }
  await db.delete(secretariesTable).where(inArray(secretariesTable.userId, userIds));

  if (patientIds.length > 0) {
    await db.delete(patientMaterialsTable).where(inArray(patientMaterialsTable.patientId, patientIds));
    await db.delete(xpEntriesTable).where(inArray(xpEntriesTable.patientId, patientIds));
    await db.delete(checkInsTable).where(inArray(checkInsTable.patientId, patientIds));
    await db.delete(weightEntriesTable).where(inArray(weightEntriesTable.patientId, patientIds));
  }

  // aiPatientSummariesTable.generatedBy references usersTable without onDelete cascade,
  // so we must delete any summaries authored by seed users before deleting the users.
  await db.delete(aiPatientSummariesTable).where(inArray(aiPatientSummariesTable.generatedBy, userIds));

  if (doctorIds.length > 0) {
    await db.delete(patientDoctorsTable).where(inArray(patientDoctorsTable.doctorId, doctorIds));
    await db.delete(doctorsTable).where(inArray(doctorsTable.id, doctorIds));
  }

  if (patientIds.length > 0) {
    await db.delete(patientsTable).where(inArray(patientsTable.id, patientIds));
  }

  // Delete clinic_owners links for seed users before deleting users
  await db.delete(clinicOwnersTable).where(inArray(clinicOwnersTable.userId, userIds));

  // Delete forms for seed clinics (FK: forms.created_by_user_id → users.id and forms.clinic_id → clinics.id)
  if (seedClinicIds.length > 0) {
    const seedForms = await db
      .select({ id: formsTable.id })
      .from(formsTable)
      .where(inArray(formsTable.clinicId, seedClinicIds));
    const seedFormIds = seedForms.map((f) => f.id);
    if (seedFormIds.length > 0) {
      await db.delete(formAssignmentsTable).where(inArray(formAssignmentsTable.formId, seedFormIds));
      await db.delete(formQuestionsTable).where(inArray(formQuestionsTable.formId, seedFormIds));
      await db.delete(formsTable).where(inArray(formsTable.id, seedFormIds));
    }
  }

  await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  console.log(`Removidos ${userIds.length} usuários de seed anteriores.`);

  // Delete any remaining secretaries tied to the seed clinics (e.g. from a partially-applied
  // previous seed run whose userId was not in the seed list above).
  const remainingSeedClinics = await db
    .select({ id: clinicsTable.id })
    .from(clinicsTable)
    .where(inArray(clinicsTable.name, ["KLIE", "Vitalis Saúde"]));
  if (remainingSeedClinics.length > 0) {
    const remainingSeedClinicIds = remainingSeedClinics.map((c) => c.id);
    await db.delete(secretariesTable).where(inArray(secretariesTable.clinicId, remainingSeedClinicIds));
  }

  // Clean up seed clinics (cascades to patient_clinics, clinic_settings)
  await db.delete(clinicsTable).where(inArray(clinicsTable.name, ["KLIE", "Vitalis Saúde"]));
  console.log("Removidas clínicas de seed anteriores.");
}

async function main() {
  console.log("=== Seed de Dados de Teste ===\n");

  console.log("Aplicando migrações pendentes...");
  await migrateDb();
  console.log("Migrações OK.\n");

  await cleanSeedData();

  const hash = await hashPassword(PASSWORD);

  // ── Clinic Owner ─────────────────────────────────────────────────────────────
  console.log("Criando clinic owner...");
  const [adminUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}admin_${Date.now()}`,
      email: "carlos@gmail.com",
      name: "Carlos Oliveira de Souza",
      role: "clinic_owner",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  // ── Profissionais de Saúde ───────────────────────────────────────────────────
  console.log("Criando profissionais de saúde...");
  const [mariaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}maria_${Date.now()}`,
      email: "maria@gmail.com",
      name: "Dra. Maria Alice Regina de Souza",
      role: "profissional_saude",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [ligiaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}ligia_${Date.now()}`,
      email: "ligia@clinica.dev",
      name: "Dra. Lígia Mendonça",
      role: "profissional_saude",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [carlaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}carla_${Date.now()}`,
      email: "carla@clinica.dev",
      name: "Dra. Carla Rezende",
      role: "profissional_saude",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [paulaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}paula_${Date.now()}`,
      email: "paula@clinica.dev",
      name: "Dra. Paula Fonseca",
      role: "profissional_saude",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  // ── Clínicas ─────────────────────────────────────────────────────────────────
  // Create KLIE clinic BEFORE doctors so we can link clinic_id on creation
  console.log("Criando clínica KLIE...");
  const [klieClinic] = await db
    .insert(clinicsTable)
    .values({ name: "KLIE", primaryColor: "#16a34a" })
    .returning();

  // Link clinic owner to KLIE
  await db.insert(clinicOwnersTable).values({
    userId: adminUser!.id,
    clinicId: klieClinic!.id,
  });

  // Create clinic settings for KLIE
  await db.insert(clinicSettingsTable).values({
    clinicId: klieClinic!.id,
    plan: "professional",
    clinicName: "KLIE",
  });

  // ── Segunda clínica: Vitalis Saúde ──────────────────────────────────────────
  console.log("Criando clínica Vitalis Saúde...");
  const [vitalisClinic] = await db
    .insert(clinicsTable)
    .values({ name: "Vitalis Saúde", primaryColor: "#7c3aed" })
    .returning();

  // Link the same clinic owner (Carlos) to Vitalis Saúde
  await db.insert(clinicOwnersTable).values({
    userId: adminUser!.id,
    clinicId: vitalisClinic!.id,
  });

  // Create clinic settings for Vitalis Saúde
  await db.insert(clinicSettingsTable).values({
    clinicId: vitalisClinic!.id,
    plan: "enterprise",
    clinicName: "Vitalis Saúde",
  });

  // ── Doctors (linked to KLIE) ─────────────────────────────────────────────────
  const [mariaDoctor] = await db
    .insert(doctorsTable)
    .values({ userId: mariaUser!.id, clinicId: klieClinic!.id, specialty: "endocrinologist", bio: "Endocrinologista com foco em emagrecimento saudável e saúde hormonal." })
    .returning();

  const [ligiaDoctor] = await db
    .insert(doctorsTable)
    .values({ userId: ligiaUser!.id, clinicId: klieClinic!.id, specialty: "endocrinologist", bio: "Especialista em endocrinologia e emagrecimento saudável." })
    .returning();

  const [carlaDoctor] = await db
    .insert(doctorsTable)
    .values({ userId: carlaUser!.id, clinicId: klieClinic!.id, specialty: "psychologist", bio: "Psicóloga especializada em comportamento alimentar." })
    .returning();

  const [paulaDoctor] = await db
    .insert(doctorsTable)
    .values({ userId: paulaUser!.id, clinicId: klieClinic!.id, specialty: "nutritionist", bio: "Nutricionista com foco em planos alimentares personalizados." })
    .returning();

  // ── Secretária (KLIE) ────────────────────────────────────────────────────────
  console.log("Criando secretária...");
  const [secretariaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}secretaria_${Date.now()}`,
      email: "secretaria@gmail.com",
      name: "Sandra Almeida Ferreira",
      role: "secretaria",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  await db.insert(secretariesTable).values({ userId: secretariaUser!.id, clinicId: klieClinic!.id });

  // ── Profissionais de Saúde (Vitalis Saúde) ──────────────────────────────────
  console.log("Criando profissionais de saúde da Vitalis Saúde...");
  const [robertoUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}roberto_${Date.now()}`,
      email: "roberto@vitalis.dev",
      name: "Dr. Roberto Castro Almeida",
      role: "profissional_saude",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [fernandaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}fernanda_${Date.now()}`,
      email: "fernanda@vitalis.dev",
      name: "Dra. Fernanda Lopes Ribeiro",
      role: "profissional_saude",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [julianoUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}juliano_${Date.now()}`,
      email: "juliano@vitalis.dev",
      name: "Dr. Juliano Prado Santana",
      role: "profissional_saude",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  // ── Doctors (linked to Vitalis Saúde) ───────────────────────────────────────
  const [robertoDoctor] = await db
    .insert(doctorsTable)
    .values({ userId: robertoUser!.id, clinicId: vitalisClinic!.id, specialty: "general", bio: "Clínico geral com foco em saúde cardiovascular e emagrecimento seguro." })
    .returning();

  const [fernandaDoctor] = await db
    .insert(doctorsTable)
    .values({ userId: fernandaUser!.id, clinicId: vitalisClinic!.id, specialty: "nutritionist", bio: "Nutricionista clínica especializada em reeducação alimentar." })
    .returning();

  const [julianoDoctor] = await db
    .insert(doctorsTable)
    .values({ userId: julianoUser!.id, clinicId: vitalisClinic!.id, specialty: "psychologist", bio: "Psicólogo especializado em terapia comportamental e ansiedade alimentar." })
    .returning();

  // ── Pacientes ────────────────────────────────────────────────────────────────
  console.log("Criando pacientes...");
  const [anaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}ana_${Date.now()}`,
      email: "ana@paciente.dev",
      name: "Ana Beatriz Costa",
      role: "patient",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [brunoUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}bruno_${Date.now()}`,
      email: "bruno@paciente.dev",
      name: "Bruno Oliveira",
      role: "patient",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [claudiaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}claudia_${Date.now()}`,
      email: "claudia@paciente.dev",
      name: "Cláudia Martins",
      role: "patient",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [nayaraUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}nayara_${Date.now()}`,
      email: "eng.nayara@gmail.com",
      name: "Nayara de Souza",
      role: "patient",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [anaPat] = await db
    .insert(patientsTable)
    .values({
      userId: anaUser!.id,
      startWeight: "92.5",
      targetWeight: "72.0",
      dateOfBirth: "1988-03-15",
      cpf: "123.456.789-00",
      phone: "(11) 91234-5678",
      medicalConditions: "Hipotireoidismo",
    })
    .returning();

  const [brunoPat] = await db
    .insert(patientsTable)
    .values({ userId: brunoUser!.id, startWeight: "108.0", targetWeight: "85.0", dateOfBirth: "1982-07-22" })
    .returning();

  const [claudiaPat] = await db
    .insert(patientsTable)
    .values({ userId: claudiaUser!.id, startWeight: "78.3", targetWeight: "65.0", dateOfBirth: "1995-11-08" })
    .returning();

  const [nayaraPat] = await db
    .insert(patientsTable)
    .values({
      userId: nayaraUser!.id,
      startWeight: "85.0",
      targetWeight: "68.0",
      dateOfBirth: "1991-05-20",
      phone: "(21) 98765-4321",
      psychologyNotes: "Acompanhamento mensal.",
    })
    .returning();

  // ── Pacientes (Vitalis Saúde) ────────────────────────────────────────────────
  console.log("Criando pacientes da Vitalis Saúde...");
  const [marceloUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}marcelo_${Date.now()}`,
      email: "marcelo@paciente.dev",
      name: "Marcelo Andrade Lima",
      role: "patient",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [patriciaUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}patricia_${Date.now()}`,
      email: "patricia@paciente.dev",
      name: "Patrícia Nunes Ferreira",
      role: "patient",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [diegoUser] = await db
    .insert(usersTable)
    .values({
      clerkId: `${SEED_MARKER}diego_${Date.now()}`,
      email: "diego@paciente.dev",
      name: "Diego Ramos Teixeira",
      role: "patient",
      passwordHash: hash,
      isTemporaryPassword: false,
    })
    .returning();

  const [marceloPat] = await db
    .insert(patientsTable)
    .values({ userId: marceloUser!.id, startWeight: "95.0", targetWeight: "80.0", dateOfBirth: "1990-02-10" })
    .returning();

  const [patriciaPat] = await db
    .insert(patientsTable)
    .values({ userId: patriciaUser!.id, startWeight: "70.0", targetWeight: "60.0", dateOfBirth: "1993-09-05" })
    .returning();

  const [diegoPat] = await db
    .insert(patientsTable)
    .values({ userId: diegoUser!.id, startWeight: "110.0", targetWeight: "90.0", dateOfBirth: "1985-12-01" })
    .returning();

  // ── Enroll patients in KLIE ────────────────────────────────────────────────
  console.log("Inscrevendo pacientes na clínica KLIE...");
  await db.insert(patientClinicsTable).values([
    { patientId: anaPat!.id, clinicId: klieClinic!.id },
    { patientId: brunoPat!.id, clinicId: klieClinic!.id },
    { patientId: claudiaPat!.id, clinicId: klieClinic!.id },
    { patientId: nayaraPat!.id, clinicId: klieClinic!.id },
  ]);

  // ── Enroll patients in Vitalis Saúde ────────────────────────────────────────
  console.log("Inscrevendo pacientes na clínica Vitalis Saúde...");
  await db.insert(patientClinicsTable).values([
    { patientId: marceloPat!.id, clinicId: vitalisClinic!.id },
    { patientId: patriciaPat!.id, clinicId: vitalisClinic!.id },
    { patientId: diegoPat!.id, clinicId: vitalisClinic!.id },
  ]);

  // ── Atribuições ──────────────────────────────────────────────────────────────
  console.log("Atribuindo profissionais a pacientes...");
  await db.insert(patientDoctorsTable).values([
    { patientId: anaPat!.id, doctorId: ligiaDoctor!.id },
    { patientId: anaPat!.id, doctorId: carlaDoctor!.id },
    { patientId: brunoPat!.id, doctorId: ligiaDoctor!.id },
    { patientId: brunoPat!.id, doctorId: paulaDoctor!.id },
    { patientId: claudiaPat!.id, doctorId: carlaDoctor!.id },
    { patientId: claudiaPat!.id, doctorId: paulaDoctor!.id },
    { patientId: nayaraPat!.id, doctorId: mariaDoctor!.id },
    { patientId: nayaraPat!.id, doctorId: ligiaDoctor!.id },
    { patientId: nayaraPat!.id, doctorId: paulaDoctor!.id },
    { patientId: marceloPat!.id, doctorId: robertoDoctor!.id },
    { patientId: marceloPat!.id, doctorId: fernandaDoctor!.id },
    { patientId: patriciaPat!.id, doctorId: fernandaDoctor!.id },
    { patientId: patriciaPat!.id, doctorId: julianoDoctor!.id },
    { patientId: diegoPat!.id, doctorId: robertoDoctor!.id },
    { patientId: diegoPat!.id, doctorId: julianoDoctor!.id },
  ]);

  // ── Metas customizadas (migração das metas fixas antigas) ──────────────────
  // As antigas metas fixas (targetWeight, dailyWaterGoalMl,
  // dailyExerciseCalorieGoal) continuam existindo nas tabelas de pacientes
  // (não removidas — check-ins, XP e histórico não são afetados), mas agora
  // toda meta "oficial" nasce como um registro em `goals`, atribuído à Dra.
  // Maria Alice, para exercitar o novo sistema de metas por profissional.
  console.log("Migrando metas fixas antigas para o novo sistema de metas...");
  const legacyGoalPatients: Array<{
    patient: typeof patientsTable.$inferSelect;
    clinicId: number;
    dailyWaterGoalMl: number;
    dailyExerciseCalorieGoal: number;
  }> = [
    { patient: anaPat!, clinicId: klieClinic!.id, dailyWaterGoalMl: 2000, dailyExerciseCalorieGoal: 300 },
    { patient: brunoPat!, clinicId: klieClinic!.id, dailyWaterGoalMl: 2500, dailyExerciseCalorieGoal: 350 },
    { patient: claudiaPat!, clinicId: klieClinic!.id, dailyWaterGoalMl: 2000, dailyExerciseCalorieGoal: 300 },
    { patient: nayaraPat!, clinicId: klieClinic!.id, dailyWaterGoalMl: 2200, dailyExerciseCalorieGoal: 300 },
    { patient: marceloPat!, clinicId: vitalisClinic!.id, dailyWaterGoalMl: 2500, dailyExerciseCalorieGoal: 400 },
    { patient: patriciaPat!, clinicId: vitalisClinic!.id, dailyWaterGoalMl: 2000, dailyExerciseCalorieGoal: 300 },
    { patient: diegoPat!, clinicId: vitalisClinic!.id, dailyWaterGoalMl: 2500, dailyExerciseCalorieGoal: 350 },
  ];

  for (const { patient, clinicId, dailyWaterGoalMl, dailyExerciseCalorieGoal } of legacyGoalPatients) {
    const goalsToInsert: (typeof goalsTable.$inferInsert)[] = [];
    if (patient.targetWeight) {
      goalsToInsert.push({
        patientId: patient.id,
        createdByDoctorId: mariaDoctor!.id,
        clinicId,
        title: "Atingir peso ideal",
        description: `Meta de peso definida durante o acompanhamento endocrinológico.`,
        targetValue: patient.targetWeight,
        unit: "kg",
        status: "active",
      });
    }
    goalsToInsert.push({
      patientId: patient.id,
      createdByDoctorId: mariaDoctor!.id,
      clinicId,
      title: "Beber água diariamente",
      description: "Manter a hidratação recomendada ao longo do dia.",
      targetValue: String(dailyWaterGoalMl),
      unit: "ml/dia",
      status: "active",
    });
    goalsToInsert.push({
      patientId: patient.id,
      createdByDoctorId: mariaDoctor!.id,
      clinicId,
      title: "Praticar exercício físico",
      description: "Meta diária de gasto calórico com atividade física.",
      targetValue: String(dailyExerciseCalorieGoal),
      unit: "kcal/dia",
      status: "active",
    });
    await db.insert(goalsTable).values(goalsToInsert);
  }

  // ── Check-ins (14 dias) ──────────────────────────────────────────────────────
  console.log("Criando check-ins...");
  const checkInData = [
    // Ana - boa aderência
    { patientId: anaPat!.id, patterns: [true, true, true, true, true, false, true, true, true, false, true, true, true, true] },
    // Bruno - aderência média
    { patientId: brunoPat!.id, patterns: [true, false, true, true, false, true, false, true, true, false, false, true, true, false] },
    // Cláudia - ótima aderência
    { patientId: claudiaPat!.id, patterns: [true, true, true, true, true, true, true, true, false, true, true, true, true, true] },
    // Nayara - aderência crescente
    { patientId: nayaraPat!.id, patterns: [false, true, false, true, true, false, true, true, true, true, false, true, true, true] },
    // Marcelo - aderência média
    { patientId: marceloPat!.id, patterns: [true, true, false, true, false, true, true, false, true, false, true, false, true, true] },
    // Patrícia - ótima aderência
    { patientId: patriciaPat!.id, patterns: [true, true, true, true, true, true, false, true, true, true, true, true, true, true] },
    // Diego - aderência baixa, mas crescente
    { patientId: diegoPat!.id, patterns: [false, false, true, false, true, false, true, true, false, true, true, true, true, true] },
  ];

  const allCheckIns: (typeof checkInsTable.$inferSelect)[] = [];
  for (const { patientId, patterns } of checkInData) {
    for (let i = 0; i < patterns.length; i++) {
      const fullDay = patterns[i];
      const daysAgo = 13 - i;
      const [ci] = await db
        .insert(checkInsTable)
        .values({
          patientId,
          date: dateStr(daysAgo),
          didExercise: fullDay ?? false,
          drankWater: fullDay ?? i % 2 === 0,
          ateWell: fullDay ?? i % 3 !== 0,
          note: fullDay ? null : "Dia difícil, mas tentei ao máximo.",
          xpEarned: 0,
        })
        .returning();
      allCheckIns.push(ci!);
    }
  }

  // ── XP entries ──────────────────────────────────────────────────────────────
  console.log("Criando entradas de XP...");
  const xpRows: { patientId: number; points: number; reason: "exercise" | "water" | "nutrition" | "weekly_bonus" | "monthly_bonus"; date: string }[] = [];
  for (const ci of allCheckIns) {
    if (ci.didExercise) xpRows.push({ patientId: ci.patientId, points: 50, reason: "exercise", date: ci.date });
    if (ci.drankWater) xpRows.push({ patientId: ci.patientId, points: 50, reason: "water", date: ci.date });
    if (ci.ateWell) xpRows.push({ patientId: ci.patientId, points: 50, reason: "nutrition", date: ci.date });
    if (ci.didExercise && ci.drankWater && ci.ateWell) {
      xpRows.push({ patientId: ci.patientId, points: 50, reason: "weekly_bonus", date: ci.date });
    }
  }
  if (xpRows.length > 0) {
    await db.insert(xpEntriesTable).values(xpRows);
  }

  // ── Histórico de peso (4 semanas) ────────────────────────────────────────────
  console.log("Criando histórico de peso...");
  const weightData = [
    {
      patientId: anaPat!.id,
      weights: [
        { daysAgo: 28, kg: "92.5" },
        { daysAgo: 21, kg: "91.2" },
        { daysAgo: 14, kg: "90.1" },
        { daysAgo: 7, kg: "89.0" },
      ],
    },
    {
      patientId: brunoPat!.id,
      weights: [
        { daysAgo: 28, kg: "108.0" },
        { daysAgo: 21, kg: "106.5" },
        { daysAgo: 14, kg: "105.2" },
        { daysAgo: 7, kg: "104.0" },
      ],
    },
    {
      patientId: claudiaPat!.id,
      weights: [
        { daysAgo: 28, kg: "78.3" },
        { daysAgo: 21, kg: "77.5" },
        { daysAgo: 14, kg: "76.8" },
        { daysAgo: 7, kg: "75.9" },
      ],
    },
    {
      patientId: nayaraPat!.id,
      weights: [
        { daysAgo: 28, kg: "85.0" },
        { daysAgo: 21, kg: "83.8" },
        { daysAgo: 14, kg: "82.5" },
        { daysAgo: 7, kg: "81.4" },
      ],
    },
    {
      patientId: marceloPat!.id,
      weights: [
        { daysAgo: 28, kg: "95.0" },
        { daysAgo: 21, kg: "93.6" },
        { daysAgo: 14, kg: "92.4" },
        { daysAgo: 7, kg: "91.1" },
      ],
    },
    {
      patientId: patriciaPat!.id,
      weights: [
        { daysAgo: 28, kg: "70.0" },
        { daysAgo: 21, kg: "68.9" },
        { daysAgo: 14, kg: "67.7" },
        { daysAgo: 7, kg: "66.5" },
      ],
    },
    {
      patientId: diegoPat!.id,
      weights: [
        { daysAgo: 28, kg: "110.0" },
        { daysAgo: 21, kg: "109.2" },
        { daysAgo: 14, kg: "107.8" },
        { daysAgo: 7, kg: "106.5" },
      ],
    },
  ];

  for (const { patientId, weights } of weightData) {
    for (const { daysAgo, kg } of weights) {
      await db.insert(weightEntriesTable).values({ patientId, date: dateStr(daysAgo), weightKg: kg });
    }
  }

  // ── Materiais ────────────────────────────────────────────────────────────────
  console.log("Criando materiais para pacientes...");
  const materials = [
    // Ana
    {
      patientId: anaPat!.id,
      senderId: ligiaUser!.id,
      type: "prescription" as const,
      title: "Receita — Ozempic 0.5mg",
      description: "Aplicação semanal conforme orientação médica.",
    },
    {
      patientId: anaPat!.id,
      senderId: paulaUser!.id,
      type: "meal_plan" as const,
      title: "Cardápio Semana 1",
      description: "Plano alimentar com 1400 kcal/dia.",
    },
    {
      patientId: anaPat!.id,
      senderId: carlaUser!.id,
      type: "pdf" as const,
      title: "Diário Alimentar",
      description: "Formulário para registro diário das refeições.",
    },
    {
      patientId: anaPat!.id,
      senderId: ligiaUser!.id,
      type: "video" as const,
      title: "Exercícios para iniciantes",
      externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      description: "Série de exercícios leves para começar a rotina.",
    },
    // Bruno
    {
      patientId: brunoPat!.id,
      senderId: ligiaUser!.id,
      type: "prescription" as const,
      title: "Receita — Metformina 500mg",
      description: "Tomar 1 comprimido após o almoço.",
    },
    {
      patientId: brunoPat!.id,
      senderId: paulaUser!.id,
      type: "meal_plan" as const,
      title: "Cardápio Masculino — 1800 kcal",
      description: "Foco em proteínas e controle de carboidratos.",
    },
    {
      patientId: brunoPat!.id,
      senderId: carlaUser!.id,
      type: "pdf" as const,
      title: "Técnicas Anti-Ansiedade",
      description: "Guia de respiração e mindfulness para compulsão alimentar.",
    },
    {
      patientId: brunoPat!.id,
      senderId: paulaUser!.id,
      type: "video" as const,
      title: "Como ler rótulos nutricionais",
      externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    // Cláudia
    {
      patientId: claudiaPat!.id,
      senderId: carlaUser!.id,
      type: "pdf" as const,
      title: "Escala de Fome e Saciedade",
      description: "Aprenda a identificar a fome real vs. emocional.",
    },
    {
      patientId: claudiaPat!.id,
      senderId: paulaUser!.id,
      type: "meal_plan" as const,
      title: "Cardápio Plant-Based — 1600 kcal",
      description: "Opção vegetariana com todos os nutrientes essenciais.",
    },
    {
      patientId: claudiaPat!.id,
      senderId: carlaUser!.id,
      type: "video" as const,
      title: "Psicologia do emagrecimento",
      externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    {
      patientId: claudiaPat!.id,
      senderId: paulaUser!.id,
      type: "prescription" as const,
      title: "Suplemento — Whey Protein",
      description: "25g após treino, 3x por semana.",
    },
    // Nayara
    {
      patientId: nayaraPat!.id,
      senderId: mariaUser!.id,
      type: "prescription" as const,
      title: "Receita — Saxenda 0.6mg",
      description: "Aplicação diária subcutânea; aumentar dose conforme protocolo.",
    },
    {
      patientId: nayaraPat!.id,
      senderId: paulaUser!.id,
      type: "meal_plan" as const,
      title: "Cardápio Engenheira — 1500 kcal",
      description: "Refeições práticas para rotina de trabalho intenso.",
    },
    {
      patientId: nayaraPat!.id,
      senderId: paulaUser!.id,
      type: "pdf" as const,
      title: "Guia de Lanches Saudáveis",
      description: "Opções rápidas e nutritivas para o intervalo do trabalho.",
    },
    {
      patientId: nayaraPat!.id,
      senderId: mariaUser!.id,
      type: "video" as const,
      title: "Treino HIIT 20 minutos",
      externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      description: "Sessão de alta intensidade adaptada para quem tem pouco tempo.",
    },
  ];

  for (const mat of materials) {
    await db.insert(patientMaterialsTable).values(mat);
  }

  // ── PAR-Q Form (Questionário de Aptidão Física) ───────────────────────────
  console.log("Criando formulário PAR-Q para KLIE...");
  const [parqForm] = await db
    .insert(formsTable)
    .values({
      clinicId: klieClinic!.id,
      createdByUserId: mariaUser!.id,
      title: "PAR-Q — Questionário de Aptidão Física",
      description:
        "O PAR-Q (Physical Activity Readiness Questionnaire) avalia se você está apto para iniciar atividades físicas. Responda com sinceridade.",
      isMandatory: true,
      isActive: true,
    })
    .returning();

  const parqQuestions = [
    {
      text: "Seu médico já disse que você possui algum problema cardíaco e recomendou que você somente realizasse atividades físicas sob supervisão médica?",
      questionType: "yes_no" as const,
      orderIndex: 0,
    },
    {
      text: "Você sente dor no peito quando pratica atividade física?",
      questionType: "yes_no" as const,
      orderIndex: 1,
    },
    {
      text: "No último mês, você teve dor no peito quando não estava praticando atividade física?",
      questionType: "yes_no" as const,
      orderIndex: 2,
    },
    {
      text: "Você perde o equilíbrio por causa de tontura ou já perdeu a consciência alguma vez?",
      questionType: "yes_no" as const,
      orderIndex: 3,
    },
    {
      text: "Você tem algum problema ósseo ou articular que poderia ser piorado por uma mudança em sua atividade física?",
      questionType: "yes_no" as const,
      orderIndex: 4,
    },
    {
      text: "Seu médico está te prescrevendo medicamentos para pressão arterial ou problema cardíaco?",
      questionType: "yes_no" as const,
      orderIndex: 5,
    },
    {
      text: "Você tem conhecimento de qualquer outra razão pela qual não deveria praticar atividade física?",
      questionType: "yes_no" as const,
      orderIndex: 6,
    },
    {
      text: "Qual é o seu nível atual de atividade física?",
      questionType: "multiple_choice" as const,
      options: ["Sedentário (não pratico exercícios)", "Levemente ativo (1-2x por semana)", "Moderadamente ativo (3-4x por semana)", "Muito ativo (5+ dias por semana)"] as string[],
      orderIndex: 7,
    },
    {
      text: "Descreva alguma condição de saúde, lesão recente ou cirurgia que considere relevante informar ao profissional de saúde:",
      questionType: "text" as const,
      orderIndex: 8,
    },
  ];

  for (const q of parqQuestions) {
    await db.insert(formQuestionsTable).values({
      formId: parqForm!.id,
      text: q.text,
      questionType: q.questionType,
      options: "options" in q ? q.options : null,
      orderIndex: q.orderIndex,
    });
  }

  // Assign PAR-Q to all patients in the KLIE clinic
  await db.insert(formAssignmentsTable).values({
    formId: parqForm!.id,
    patientId: null, // null = all patients in clinic
  });

  console.log("\n=== Seed concluído com sucesso! ===\n");
  console.log("Credenciais dos usuários de teste:");
  console.log("------------------------------------");
  console.log("CLINIC OWNER (dono das duas clínicas)");
  console.log(`  carlos@gmail.com          / ${PASSWORD}  (Carlos Oliveira de Souza)`);
  console.log("\nPROFISSIONAIS DE SAÚDE — KLIE");
  console.log(`  maria@gmail.com           / ${PASSWORD}  (Dra. Maria Alice Regina de Souza — Endocrinologista)`);
  console.log(`  ligia@clinica.dev         / ${PASSWORD}  (Dra. Lígia Mendonça — Endocrinologista)`);
  console.log(`  carla@clinica.dev         / ${PASSWORD}  (Dra. Carla Rezende — Psicóloga)`);
  console.log(`  paula@clinica.dev         / ${PASSWORD}  (Dra. Paula Fonseca — Nutricionista)`);
  console.log("\nSECRETÁRIA — KLIE");
  console.log(`  secretaria@gmail.com      / ${PASSWORD}  (Sandra Almeida Ferreira)`);
  console.log("\nPACIENTES — KLIE");
  console.log(`  ana@paciente.dev          / ${PASSWORD}  (Ana Beatriz Costa)`);
  console.log(`  bruno@paciente.dev        / ${PASSWORD}  (Bruno Oliveira)`);
  console.log(`  claudia@paciente.dev      / ${PASSWORD}  (Cláudia Martins)`);
  console.log(`  eng.nayara@gmail.com      / ${PASSWORD}  (Nayara de Souza)`);
  console.log("\nPROFISSIONAIS DE SAÚDE — Vitalis Saúde");
  console.log(`  roberto@vitalis.dev       / ${PASSWORD}  (Dr. Roberto Castro Almeida — Cardiologista)`);
  console.log(`  fernanda@vitalis.dev      / ${PASSWORD}  (Dra. Fernanda Lopes Ribeiro — Nutricionista)`);
  console.log(`  juliano@vitalis.dev       / ${PASSWORD}  (Dr. Juliano Prado Santana — Psicólogo)`);
  console.log("\nPACIENTES — Vitalis Saúde");
  console.log(`  marcelo@paciente.dev      / ${PASSWORD}  (Marcelo Andrade Lima)`);
  console.log(`  patricia@paciente.dev     / ${PASSWORD}  (Patrícia Nunes Ferreira)`);
  console.log(`  diego@paciente.dev        / ${PASSWORD}  (Diego Ramos Teixeira)`);
  console.log("------------------------------------");
  console.log("\nCLÍNICAS");
  console.log(`  KLIE (id: ${klieClinic!.id}, plano: professional) — Carlos + 4 profissionais + 4 pacientes`);
  console.log(`  Vitalis Saúde (id: ${vitalisClinic!.id}, plano: enterprise) — Carlos + 3 profissionais + 3 pacientes`);

  void adminUser;
  await pool.end();
}

main().catch((err) => {
  console.error("Seed falhou:", err);
  process.exit(1);
});
