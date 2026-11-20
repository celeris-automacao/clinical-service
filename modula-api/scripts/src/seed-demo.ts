/**
 * Local-only, additive demo fixtures. No credentials, real payments or notifications.
 * Usage: seed:demo <clinicId> <ownerUserId> [--target-only] [YYYY-MM-DD]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import {
  appointmentsTable, appointmentReviewsTable, calorieEntriesTable, carePackagesTable,
  carePackageSlotsTable, checkInsTable, clinicGalleryPhotosTable, clinicOwnersTable,
  clinicPublicPagesTable, clinicPublicServicesTable, clinicSettingsTable, clinicsTable,
  communityCommentsTable, communityPostLikesTable, communityPostsTable, contractsTable,
  conversationsTable, doctorInsurancesTable, doctorsTable, exerciseEntriesTable,
  expensesTable, formAssignmentsTable, formQuestionsTable, formResponseAnswersTable,
  formResponsesTable, formsTable, goalProgressTable, goalsTable, leadsTable, messagesTable,
  patientClinicsTable, patientDoctorsTable, patientMaterialsTable, patientNotesTable,
  patientPackageDoctorsTable, patientPackagesTable, patientsTable, professionalAvailabilityTable,
  secretariesTable, staffEventsTable, usersTable, waterEntriesTable, weightEntriesTable,
  xpEntriesTable,
} from "@workspace/db";

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

interface BillingDemoClinic {
  clinicId: number;
  amountCents: number;
  nextChargeDate: string;
  cardBrand: string;
  cardLast4: string;
  history: { date: string; amountCents: number }[];
}

interface BillingDemoFile {
  version: 1;
  clinics: BillingDemoClinic[];
}

function isBillingDemoFile(value: unknown): value is BillingDemoFile {
  if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1
    || !("clinics" in value) || !Array.isArray(value.clinics)) return false;
  return value.clinics.every((clinic: unknown) =>
    typeof clinic === "object" && clinic !== null
    && "clinicId" in clinic && typeof clinic.clinicId === "number"
    && "amountCents" in clinic && typeof clinic.amountCents === "number"
    && "nextChargeDate" in clinic && typeof clinic.nextChargeDate === "string"
    && "cardBrand" in clinic && typeof clinic.cardBrand === "string"
    && "cardLast4" in clinic && typeof clinic.cardLast4 === "string"
    && "history" in clinic && Array.isArray(clinic.history)
    && clinic.history.every((entry: unknown) =>
      typeof entry === "object" && entry !== null
      && "date" in entry && typeof entry.date === "string"
      && "amountCents" in entry && typeof entry.amountCents === "number"));
}

async function main() {
  const clinicId = Number(process.argv[2]);
  const ownerId = Number(process.argv[3]);
  const options = process.argv.slice(4);
  const targetOnly = options.includes("--target-only");
  const referenceDate = options.find((option) => option !== "--target-only");
  const today = referenceDate ?? new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  if (!Number.isSafeInteger(clinicId) || clinicId <= 0 || !Number.isSafeInteger(ownerId) || ownerId <= 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(Date.parse(`${today}T12:00:00Z`))
    || shiftDate(today, 0) !== today) {
    throw new Error("Uso: seed:demo <clinicId> <ownerUserId> [--target-only] [AAAA-MM-DD válido]");
  }
  const connectionString = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production" || !connectionString
    || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(connectionString).hostname)) {
    throw new Error("Este seed aceita somente banco local e ambiente nao produtivo.");
  }
  const pool = new Pool({ connectionString });
  const appUrl = new URL(process.env.APP_URL ?? "http://127.0.0.1:5177");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname) || appUrl.protocol !== "http:") {
    throw new Error("APP_URL deve apontar para o frontend HTTP local.");
  }
  const assetUrl = (file: string) => new URL(`/demo/${file}`, appUrl).href;
  const db = drizzle(pool);
  const period = today.slice(0, 7);
  const demoClinics: { clinicId: number; amountCents: number }[] = [];
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(76312026)`);
      const [owner] = await tx.select().from(usersTable).where(eq(usersTable.id, ownerId));
      const [membership] = await tx.select().from(clinicOwnersTable).where(and(
        eq(clinicOwnersTable.userId, ownerId), eq(clinicOwnersTable.clinicId, clinicId),
      ));
      if (!owner || owner.role !== "clinic_owner" || !membership) {
        throw new Error("Informe um proprietario existente vinculado a clinica de destino.");
      }
      const [target] = await tx.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
      if (!target) throw new Error("Clinica de destino nao encontrada.");
      const clinicList = [target];
      const identities = targetOnly ? [] : [
        { name: "Aurora - Clínica Demonstração", slug: "demo-aurora", color: "#0f766e", asset: "aurora",
          tagline: "Cuidado que acompanha cada novo começo.",
          about: "Clínica fictícia para homologação. Uma identidade acolhedora em verde-petróleo e pêssego, com acompanhamento integrado. Nenhum atendimento real é oferecido nesta página." },
        { name: "Horizonte - Saúde Demonstração", slug: "demo-horizonte", color: "#6d28d9", asset: "horizonte",
          tagline: "Mais equilíbrio para os seus próximos passos.",
          about: "Clínica fictícia para homologação. Identidade em violeta e dourado, com foco em experiência digital e bem-estar. Os profissionais, serviços e pacientes são exemplos de teste." },
      ];
      for (const identity of identities) {
        let [clinic] = await tx.select().from(clinicsTable).where(eq(clinicsTable.name, identity.name));
        if (!clinic) {
          [clinic] = await tx.insert(clinicsTable).values({
            name: identity.name, logoUrl: assetUrl(`${identity.asset}-logo.svg`), primaryColor: identity.color,
          }).returning();
        }
        if (!clinic) throw new Error("Falha ao criar clinica de demonstracao.");
        await tx.insert(clinicOwnersTable).values({ userId: ownerId, clinicId: clinic.id }).onConflictDoNothing();
        await tx.insert(clinicSettingsTable).values({
          clinicId: clinic.id, plan: "professional", clinicName: identity.name,
          logoUrl: assetUrl(`${identity.asset}-logo.svg`), senderName: `${identity.name} (teste)`,
        }).onConflictDoNothing({ target: clinicSettingsTable.clinicId });
        const [page] = await tx.select().from(clinicPublicPagesTable).where(eq(clinicPublicPagesTable.clinicId, clinic.id));
        if (!page) {
          await tx.insert(clinicPublicPagesTable).values({
            clinicId: clinic.id, slug: identity.slug, published: true,
            tagline: identity.tagline, about: identity.about,
            coverImageUrl: assetUrl(`${identity.asset}-cover.svg`),
            address: "Endereço fictício - ambiente de demonstração",
            contactEmail: `${identity.asset}@demo-test.invalid`,
            businessHours: { "Segunda a sexta": "08:00 às 18:00", Sábado: "08:00 às 12:00" },
          });
        }
        for (const [order, title] of ["Avaliação integrada", "Acompanhamento nutricional", "Consulta de retorno"].entries()) {
          const [existing] = await tx.select().from(clinicPublicServicesTable).where(and(
            eq(clinicPublicServicesTable.clinicId, clinic.id), eq(clinicPublicServicesTable.title, title),
          ));
          if (!existing) await tx.insert(clinicPublicServicesTable).values({
            clinicId: clinic.id, title, description: "Serviço fictício para testar a apresentação da clínica.", order,
          });
        }
        for (const [order, kind] of ["cover", "logo"].entries()) {
          const url = assetUrl(`${identity.asset}-${kind}.svg`);
          const [photo] = await tx.select().from(clinicGalleryPhotosTable).where(and(
            eq(clinicGalleryPhotosTable.clinicId, clinic.id), eq(clinicGalleryPhotosTable.url, url),
          ));
          if (!photo) await tx.insert(clinicGalleryPhotosTable).values({
            clinicId: clinic.id, url, caption: `Identidade visual ${identity.asset} - demonstração`, order,
          });
        }
        clinicList.push(clinic);
      }

      for (const clinic of clinicList) {
        const id = clinic.id;
        const [settings] = await tx.select().from(clinicSettingsTable).where(eq(clinicSettingsTable.clinicId, id));
        const amounts = { basic: 14900, pro: 29900, professional: 49900, enterprise: 79900 };
        demoClinics.push({ clinicId: id, amountCents: amounts[settings?.plan ?? "basic"] });
        const doctorList: (typeof doctorsTable.$inferSelect)[] = [];
        for (let index = 0; index < 2; index++) {
          const email = `doctor-${id}-${index}@demo-test.invalid`;
          await tx.insert(usersTable).values({
            email, name: index === 0 ? "Dra. Marina Exemplo (DEMO)" : "Dr. Lucas Exemplo (DEMO)",
            role: "profissional_saude",
          }).onConflictDoNothing({ target: usersTable.email });
          const [user] = await tx.select().from(usersTable).where(eq(usersTable.email, email));
          if (!user || user.role !== "profissional_saude") throw new Error("Usuario demo conflitante.");
          let [doctor] = await tx.select().from(doctorsTable).where(and(eq(doctorsTable.userId, user.id), eq(doctorsTable.clinicId, id)));
          if (!doctor) {
            const existing = await tx.select({ id: doctorsTable.id }).from(doctorsTable).where(eq(doctorsTable.clinicId, id));
            const limit = { basic: 2, pro: 5, professional: 10, enterprise: Infinity }[settings?.plan ?? "basic"];
            if (existing.length >= limit) throw new Error(`Clinica ${id} sem vagas para profissionais demo; ajuste o plano antes.`);
            [doctor] = await tx.insert(doctorsTable).values({
              userId: user.id, clinicId: id, specialty: index === 0 ? "Clínica geral" : "Nutrição",
              consultationPrice: index === 0 ? "280.00" : "220.00", commissionPercent: index === 0 ? "35.00" : "40.00",
              acceptsInsurance: true, showOnPublicPage: id !== clinicId,
              bio: "Profissional fictício, sem registro ou atendimento real. Perfil exclusivo de homologação.",
            }).returning();
          }
          if (!doctor) throw new Error("Falha ao criar profissional demo.");
          doctorList.push(doctor);
          const [insurance] = await tx.select().from(doctorInsurancesTable).where(and(
            eq(doctorInsurancesTable.doctorId, doctor.id), eq(doctorInsurancesTable.name, "Convênio Demonstração"),
          ));
          if (!insurance) await tx.insert(doctorInsurancesTable).values({
            doctorId: doctor.id, name: "Convênio Demonstração", price: "160.00",
          });
          for (const dayOfWeek of ["monday", "tuesday", "wednesday", "thursday", "friday"] as const) {
            const [availability] = await tx.select().from(professionalAvailabilityTable).where(and(
              eq(professionalAvailabilityTable.doctorId, doctor.id), eq(professionalAvailabilityTable.dayOfWeek, dayOfWeek),
            ));
            if (!availability) await tx.insert(professionalAvailabilityTable).values({
              doctorId: doctor.id, dayOfWeek, startTime: "08:00", endTime: "18:00", slotDurationMinutes: 30,
            });
          }
        }
        const secretaryEmail = `reception-${id}@demo-test.invalid`;
        await tx.insert(usersTable).values({ email: secretaryEmail, name: "Recepção Exemplo (DEMO)", role: "secretaria" })
          .onConflictDoNothing({ target: usersTable.email });
        const [secretaryUser] = await tx.select().from(usersTable).where(eq(usersTable.email, secretaryEmail));
        if (!secretaryUser || secretaryUser.role !== "secretaria") throw new Error("Recepcao demo conflitante.");
        const [secretary] = await tx.select().from(secretariesTable).where(eq(secretariesTable.userId, secretaryUser.id));
        if (secretary && secretary.clinicId !== id) throw new Error("Recepcao vinculada a outra clinica.");
        if (!secretary) await tx.insert(secretariesTable).values({ userId: secretaryUser.id, clinicId: id, salary: "2400.00" });

        const patientList: (typeof patientsTable.$inferSelect)[] = [];
        for (let index = 0; index < 10; index++) {
          const email = `patient-${id}-${index}@demo-test.invalid`;
          const name = ["Ana", "Bruno", "Clara", "Diego", "Elisa", "Fábio", "Gabriela", "Hugo", "Isabela", "João"][index];
          await tx.insert(usersTable).values({ email, name: `${name} Paciente ${index + 1} (DEMO)`, role: "patient" })
            .onConflictDoNothing({ target: usersTable.email });
          const [user] = await tx.select().from(usersTable).where(eq(usersTable.email, email));
          if (!user || user.role !== "patient") throw new Error("Paciente demo conflitante.");
          let [patient] = await tx.select().from(patientsTable).where(eq(patientsTable.userId, user.id));
          if (patient && patient.clinicId !== id) throw new Error("Paciente demo vinculado a outra clinica.");
          if (!patient) {
            const birthday = shiftDate(today, [0, 1, 3, 5, 7, 12, 20, -3, 30, 60][index]!);
            const monthDay = birthday.slice(5);
            [patient] = await tx.insert(patientsTable).values({
              userId: user.id, clinicId: id, startWeight: String(78 + index * 2), targetWeight: String(70 + index),
              dateOfBirth: `${1986 + index}-${monthDay === "02-29" ? "02-28" : monthDay}`,
              paymentType: index % 3 === 0 ? "convenio" : "particular",
              insuranceName: index % 3 === 0 ? "Convênio Demonstração" : null,
              dailyCalorieGoal: 2000, proteinGoalG: 100, carbGoalG: 250, fatGoalG: 65,
              mealsPerDay: 4, dailyWaterGoalMl: 2000,
              weightGoalStatus: index === 1 ? "pending" : "validated",
              proposedTargetWeight: index === 1 ? "68.00" : null,
              medicalConditions: "Cadastro fictício para homologação; sem dados clínicos reais.",
              createdAt: new Date(`${shiftDate(today, -70 + index * 6)}T12:00:00Z`),
            }).returning();
          }
          if (!patient) throw new Error("Falha ao criar paciente demo.");
          patientList.push(patient);
          await tx.insert(patientClinicsTable).values({ patientId: patient.id, clinicId: id }).onConflictDoNothing();
          const doctor = doctorList[index % doctorList.length]!;
          const [link] = await tx.select().from(patientDoctorsTable).where(and(
            eq(patientDoctorsTable.patientId, patient.id), eq(patientDoctorsTable.doctorId, doctor.id),
          ));
          if (!link) await tx.insert(patientDoctorsTable).values({ patientId: patient.id, doctorId: doctor.id });
          const note = "DEMO: acompanhamento fictício para testar o prontuário e o histórico.";
          const [existingNote] = await tx.select().from(patientNotesTable).where(and(
            eq(patientNotesTable.patientId, patient.id), eq(patientNotesTable.text, note),
          ));
          if (!existingNote) await tx.insert(patientNotesTable).values({
            patientId: patient.id, authorUserId: doctor.userId, authorRole: "profissional_saude", text: note,
          });
          const [material] = await tx.select().from(patientMaterialsTable).where(and(
            eq(patientMaterialsTable.patientId, patient.id), eq(patientMaterialsTable.title, "DEMO: guia de acompanhamento"),
          ));
          if (!material) await tx.insert(patientMaterialsTable).values({
            patientId: patient.id, senderId: doctor.userId, type: "other", title: "DEMO: guia de acompanhamento",
            description: "Material fictício para testar a lista e abertura de documentos.",
            fileUrl: assetUrl("guia.html"),
          });
          let [goal] = await tx.select().from(goalsTable).where(and(
            eq(goalsTable.patientId, patient.id), eq(goalsTable.title, "DEMO: acompanhar hidratação"),
          ));
          if (!goal) [goal] = await tx.insert(goalsTable).values({
            patientId: patient.id, clinicId: id, createdByDoctorId: doctor.id,
            title: "DEMO: acompanhar hidratação", description: "Meta fictícia, não é orientação clínica.",
            targetValue: "2000", unit: "ml", dueDate: shiftDate(today, 30), lastStaffChangedAt: new Date(),
          }).returning();
          if (!goal) throw new Error("Falha ao criar meta demo.");
          for (let day = 0; day < 14; day++) {
            const date = shiftDate(today, -day);
            const createdAt = new Date(`${date}T12:00:00Z`);
            const [weight] = await tx.select().from(weightEntriesTable).where(and(eq(weightEntriesTable.patientId, patient.id), eq(weightEntriesTable.date, date)));
            if (!weight) await tx.insert(weightEntriesTable).values({
              patientId: patient.id, date, weightKg: (76 + index * 2 + day * 0.12).toFixed(2), note: "DEMO", createdAt,
            });
            const [checkIn] = await tx.select().from(checkInsTable).where(and(eq(checkInsTable.patientId, patient.id), eq(checkInsTable.date, date)));
            if (!checkIn) await tx.insert(checkInsTable).values({
              patientId: patient.id, date, didExercise: day % 3 !== 0, drankWater: true,
              ateWell: true, note: "DEMO: registro fictício.", xpEarned: day % 3 !== 0 ? 150 : 100, createdAt, updatedAt: createdAt,
            });
            const [water] = await tx.select().from(waterEntriesTable).where(and(eq(waterEntriesTable.patientId, patient.id), eq(waterEntriesTable.date, date)));
            if (!water) await tx.insert(waterEntriesTable).values({ patientId: patient.id, date, amountMl: 1500 + day % 4 * 250, createdAt });
            const [calorie] = await tx.select().from(calorieEntriesTable).where(and(eq(calorieEntriesTable.patientId, patient.id), eq(calorieEntriesTable.date, date)));
            if (!calorie) await tx.insert(calorieEntriesTable).values({
              patientId: patient.id, date, mealLabel: "lunch", calories: 550 + day % 3 * 70,
              aiDescription: "DEMO: almoço fictício, estimativa não gerada por IA.", proteinG: 35, carbG: 60, fatG: 20, createdAt,
            });
            const [exercise] = await tx.select().from(exerciseEntriesTable).where(and(eq(exerciseEntriesTable.patientId, patient.id), eq(exerciseEntriesTable.date, date)));
            if (!exercise && day % 3 !== 0) await tx.insert(exerciseEntriesTable).values({
              patientId: patient.id, date, description: "DEMO: caminhada fictícia", durationMin: 30, calorieEstimate: 150, createdAt,
            });
            for (const reason of ["water", "nutrition", "exercise"] as const) {
              if (reason === "exercise" && day % 3 === 0) continue;
              const [xp] = await tx.select().from(xpEntriesTable).where(and(
                eq(xpEntriesTable.patientId, patient.id), eq(xpEntriesTable.date, date), eq(xpEntriesTable.reason, reason),
              ));
              if (!xp) await tx.insert(xpEntriesTable).values({ patientId: patient.id, date, reason, points: 50, createdAt });
            }
            await tx.insert(goalProgressTable).values({
              goalId: goal.id, date, value: String(1500 + day % 4 * 250), done: day % 4 >= 2, note: "DEMO", createdAt, updatedAt: createdAt,
            }).onConflictDoNothing();
          }
          const contractTitle = `DEMO: acompanhamento ${period}`;
          const [contract] = await tx.select().from(contractsTable).where(and(
            eq(contractsTable.patientId, patient.id), eq(contractsTable.title, contractTitle),
          ));
          if (!contract) await tx.insert(contractsTable).values({
            clinicId: id, patientId: patient.id, title: contractTitle,
            termsContent: "DOCUMENTO FICTÍCIO DE HOMOLOGAÇÃO. Sem validade jurídica, contratação ou cobrança real.",
            periodStart: today, periodEnd: shiftDate(today, 60), totalValueCents: 89000,
            status: "pending_signature",
          });
        }

        for (const [doctorIndex, doctor] of doctorList.entries()) {
          const [insurance] = await tx.select().from(doctorInsurancesTable).where(and(
            eq(doctorInsurancesTable.doctorId, doctor.id), eq(doctorInsurancesTable.name, "Convênio Demonstração"),
          ));
          for (let offset = -60; offset <= 14; offset++) {
            const date = shiftDate(today, offset);
            if ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) continue;
            for (let slot = 0; slot < 2; slot++) {
              const patient = patientList[(Math.abs(offset) + slot + doctorIndex) % patientList.length]!;
              const cancelled = Math.abs(offset) % 11 === 0 && slot === 1;
              const paid = offset < 0 && !cancelled && Math.abs(offset) % 4 !== 0;
              const [appointment] = await tx.insert(appointmentsTable).values({
                clinicId: id, doctorId: doctor.id, patientId: patient.id, date,
                startTime: slot === 0 ? "09:00" : "14:00", endTime: slot === 0 ? "09:30" : "14:30",
                status: cancelled ? "cancelled" : offset < 0 ? "completed" : "scheduled",
                modality: slot === 0 ? "presencial" : "teleconsulta",
                priceType: patient.paymentType, doctorInsuranceId: patient.paymentType === "convenio" ? insurance?.id : null,
                amountCharged: patient.paymentType === "convenio" ? "160.00" : doctor.consultationPrice,
                isPaid: paid, paymentMethod: paid ? patient.paymentType === "convenio" ? "convenio" : slot === 0 ? "pix" : "cartao" : null,
                paymentRecordedAt: paid ? new Date(`${date}T15:00:00Z`) : null,
                paymentRecordedByUserId: paid ? ownerId : null,
                paymentNotes: "DEMO: sem transação real.", cancelReason: cancelled ? "DEMO: cancelamento fictício." : null,
                confirmedAt: offset >= 0 && offset % 2 === 0 && !cancelled ? new Date() : null,
                reminderSentAt: new Date(), confirmationSentAt: new Date(),
              }).onConflictDoNothing().returning();
              if (appointment?.status === "completed" && paid && slot === 0) await tx.insert(appointmentReviewsTable).values({
                appointmentId: appointment.id, patientId: patient.id, doctorId: doctor.id,
                rating: Math.abs(offset) % 2 === 0 ? 5 : 4, comment: "DEMO: avaliação fictícia do atendimento.",
              }).onConflictDoNothing();
            }
          }
        }
        for (let month = 0; month < 3; month++) {
          const reference = new Date(`${period}-01T12:00:00Z`);
          reference.setUTCMonth(reference.getUTCMonth() - month);
          const expensePeriod = reference.toISOString().slice(0, 7);
          for (const [category, label, amount] of [
            ["salario", "Recepção", "2400.00"], ["agua", "Água", "180.00"], ["luz", "Energia", "340.00"],
            ["telefone", "Telefone", "90.00"], ["internet", "Internet", "140.00"], ["outro", "Materiais", "220.00"],
          ] as const) {
            const description = `DEMO: ${label}`;
            const [expense] = await tx.select().from(expensesTable).where(and(
              eq(expensesTable.clinicId, id), eq(expensesTable.period, expensePeriod), eq(expensesTable.description, description),
            ));
            if (!expense) await tx.insert(expensesTable).values({
              clinicId: id, category, description, amount, period: expensePeriod, createdByUserId: ownerId,
            });
          }
        }
        let [form] = await tx.select().from(formsTable).where(and(eq(formsTable.clinicId, id), eq(formsTable.title, "DEMO: avaliação inicial")));
        if (!form) [form] = await tx.insert(formsTable).values({
          clinicId: id, createdByUserId: ownerId, title: "DEMO: avaliação inicial",
          description: "Questionário fictício com os três tipos de resposta.", isMandatory: true,
        }).returning();
        if (!form) throw new Error("Falha ao criar questionario demo.");
        const questions = [
          { text: "DEMO: deseja testar o acompanhamento?", questionType: "yes_no", answer: "Sim", options: null },
          { text: "DEMO: escreva seu objetivo para o teste.", questionType: "text", answer: "Conhecer os recursos da plataforma.", options: null },
          { text: "DEMO: quais recursos quer conhecer?", questionType: "multiple_choice", answer: "Agenda|Financeiro", options: ["Agenda", "Financeiro", "Comunidade"] },
        ] as const;
        const questionList: { id: number; answer: string }[] = [];
        for (const [orderIndex, spec] of questions.entries()) {
          let [question] = await tx.select().from(formQuestionsTable).where(and(eq(formQuestionsTable.formId, form.id), eq(formQuestionsTable.text, spec.text)));
          if (!question) [question] = await tx.insert(formQuestionsTable).values({
            formId: form.id, text: spec.text, questionType: spec.questionType,
            options: spec.options ? [...spec.options] : null, orderIndex,
          }).returning();
          if (!question) throw new Error("Falha ao criar pergunta demo.");
          questionList.push({ id: question.id, answer: spec.answer });
        }
        for (const [index, patient] of patientList.entries()) {
          await tx.insert(formAssignmentsTable).values({ formId: form.id, patientId: patient.id }).onConflictDoNothing();
          const [response] = await tx.select().from(formResponsesTable).where(and(eq(formResponsesTable.formId, form.id), eq(formResponsesTable.patientId, patient.id)));
          if (!response && index < 5) {
            const [created] = await tx.insert(formResponsesTable).values({ formId: form.id, patientId: patient.id }).returning();
            if (!created) throw new Error("Falha ao criar resposta demo.");
            await tx.insert(formResponseAnswersTable).values(questionList.map((question) => ({
              responseId: created.id, questionId: question.id, answer: question.answer,
            })));
          }
        }
        let [program] = await tx.select().from(carePackagesTable).where(and(eq(carePackagesTable.clinicId, id), eq(carePackagesTable.name, "DEMO: jornada integrada")));
        if (!program) [program] = await tx.insert(carePackagesTable).values({
          clinicId: id, name: "DEMO: jornada integrada", description: "Programa fictício multidisciplinar de 60 dias.",
          durationDays: 60, priceCents: 89000,
        }).returning();
        if (!program) throw new Error("Falha ao criar programa demo.");
        for (const doctor of doctorList) {
          const [slot] = await tx.select().from(carePackageSlotsTable).where(and(
            eq(carePackageSlotsTable.packageId, program.id), eq(carePackageSlotsTable.specialty, doctor.specialty),
          ));
          if (!slot) await tx.insert(carePackageSlotsTable).values({ packageId: program.id, specialty: doctor.specialty, quantity: 1 });
        }
        const programSlots = await tx.select().from(carePackageSlotsTable).where(eq(carePackageSlotsTable.packageId, program.id));
        for (const patient of patientList.slice(0, 4)) {
          let [enrollment] = await tx.select().from(patientPackagesTable).where(and(eq(patientPackagesTable.patientId, patient.id), eq(patientPackagesTable.packageId, program.id)));
          if (!enrollment) [enrollment] = await tx.insert(patientPackagesTable).values({
            patientId: patient.id, packageId: program.id, clinicId: id, startDate: today, endDate: shiftDate(today, 60),
          }).returning();
          if (!enrollment) throw new Error("Falha ao matricular paciente demo.");
          for (const slot of programSlots) {
            const doctor = doctorList.find((item) => item.specialty === slot.specialty);
            if (!doctor) throw new Error("Especialidade demo sem profissional.");
            const [assignment] = await tx.select().from(patientPackageDoctorsTable).where(and(
              eq(patientPackageDoctorsTable.patientPackageId, enrollment.id), eq(patientPackageDoctorsTable.slotId, slot.id),
            ));
            if (!assignment) await tx.insert(patientPackageDoctorsTable).values({ patientPackageId: enrollment.id, slotId: slot.id, doctorId: doctor.id });
            const [link] = await tx.select().from(patientDoctorsTable).where(and(eq(patientDoctorsTable.patientId, patient.id), eq(patientDoctorsTable.doctorId, doctor.id)));
            if (!link) await tx.insert(patientDoctorsTable).values({ patientId: patient.id, doctorId: doctor.id });
          }
        }
        for (const [index, status] of (["novo", "contatado", "agendado", "convertido", "perdido"] as const).entries()) {
          const name = `DEMO: interessado ${index + 1}`;
          const [lead] = await tx.select().from(leadsTable).where(and(eq(leadsTable.clinicId, id), eq(leadsTable.name, name)));
          if (!lead) await tx.insert(leadsTable).values({
            clinicId: id, name, contact: `lead-${id}-${index}@demo-test.invalid`,
            source: index % 2 ? "Indicação (DEMO)" : "Página pública (DEMO)",
            status, authorUserId: ownerId,
            notes: "Fictício; não entrar em contato.", convertedPatientId: status === "convertido" ? patientList[0]!.id : null,
          });
        }
        for (const [index, content] of [
          "DEMO: boas-vindas! Este espaço usa apenas dados fictícios para testar a comunidade.",
          "DEMO: consegui registrar minha rotina de teste. Como foi sua experiência com o aplicativo?",
          "DEMO: conheça a identidade visual e os materiais de demonstração.",
        ].entries()) {
          let [post] = await tx.select().from(communityPostsTable).where(and(eq(communityPostsTable.clinicId, id), eq(communityPostsTable.content, content)));
          if (!post) [post] = await tx.insert(communityPostsTable).values({
            clinicId: id, authorUserId: index === 0 ? ownerId : patientList[index]!.userId, content,
            mediaType: index === 2 ? "photo" : null, mediaUrl: index === 2 ? assetUrl(id === clinicList[2]?.id ? "horizonte-cover.svg" : "aurora-cover.svg") : null,
          }).returning();
          if (!post) throw new Error("Falha ao criar publicacao demo.");
          await tx.insert(communityPostLikesTable).values({ postId: post.id, userId: patientList[0]!.userId }).onConflictDoNothing();
          const [comment] = await tx.select().from(communityCommentsTable).where(and(eq(communityCommentsTable.postId, post.id), eq(communityCommentsTable.content, "DEMO: comentário fictício para testar as interações.")));
          if (!comment) await tx.insert(communityCommentsTable).values({
            postId: post.id, authorUserId: patientList[0]!.userId, content: "DEMO: comentário fictício para testar as interações.",
          });
        }
        const patient = patientList[0]!;
        const participantAUserId = Math.min(ownerId, patient.userId);
        const participantBUserId = Math.max(ownerId, patient.userId);
        await tx.insert(conversationsTable).values({ clinicId: id, participantAUserId, participantBUserId }).onConflictDoNothing();
        const [conversation] = await tx.select().from(conversationsTable).where(and(
          eq(conversationsTable.clinicId, id), eq(conversationsTable.participantAUserId, participantAUserId), eq(conversationsTable.participantBUserId, participantBUserId),
        ));
        if (!conversation) throw new Error("Falha ao criar conversa demo.");
        for (const [index, content] of ["DEMO: gostaria de testar o agendamento.", "DEMO: os horários disponíveis podem ser consultados na agenda."].entries()) {
          const [message] = await tx.select().from(messagesTable).where(and(eq(messagesTable.conversationId, conversation.id), eq(messagesTable.content, content)));
          if (!message) await tx.insert(messagesTable).values({
            conversationId: conversation.id, senderId: index === 0 ? patient.userId : ownerId, content,
            readAt: index === 0 ? null : new Date(),
          });
        }
        const description = "DEMO: dados fictícios de homologação adicionados sem notificações ou cobranças reais.";
        const [event] = await tx.select().from(staffEventsTable).where(and(eq(staffEventsTable.clinicId, id), eq(staffEventsTable.description, description)));
        if (!event) await tx.insert(staffEventsTable).values({ userId: ownerId, clinicId: id, type: "demo_seed", description });
      }
    });
    const directory = fileURLToPath(new URL("../../artifacts/clinic-web/public/__local_demo__/", import.meta.url));
    await mkdir(directory, { recursive: true });
    const billingPath = `${directory}billing.json`;
    const generatedBilling: BillingDemoFile = {
      version: 1, clinics: demoClinics.map((clinic) => ({
        ...clinic, nextChargeDate: shiftDate(today, 7), cardBrand: "Visa", cardLast4: "4242",
        history: [1, 2, 3].map((month) => {
          const date = new Date(`${today}T12:00:00Z`);
          date.setUTCDate(1);
          date.setUTCMonth(date.getUTCMonth() - month);
          return { date: date.toISOString().slice(0, 10), amountCents: clinic.amountCents };
        }),
      })),
    };
    let billing = generatedBilling;
    if (targetOnly) {
      let existingBilling: BillingDemoFile;
      try {
        const parsed: unknown = JSON.parse(await readFile(billingPath, "utf8"));
        if (!isBillingDemoFile(parsed)) throw new Error("Arquivo de demonstração de faturamento inválido.");
        existingBilling = parsed;
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
        existingBilling = { version: 1, clinics: [] };
      }
      billing = {
        version: 1,
        clinics: [
          ...existingBilling.clinics.filter((clinic) => clinic.clinicId !== clinicId),
          ...generatedBilling.clinics,
        ],
      };
    }
    await writeFile(billingPath, JSON.stringify(billing, null, 2));
    console.log(`Demonstração concluída: ${demoClinics.length} clínica(s), ${demoClinics.length * 10} pacientes e ${demoClinics.length * 2} profissionais, com históricos de 14 dias.`);
    console.log(`Referência: ${today}.`);
    if (!targetOnly) console.log("Páginas públicas: /p/demo-aurora e /p/demo-horizonte.");
    console.log("Dados existentes e senhas preservados. Nenhum e-mail, push ou pagamento foi enviado.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Falha no seed de demonstracao:", error);
  process.exitCode = 1;
});
