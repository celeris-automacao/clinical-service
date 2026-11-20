import { Router, type Response } from "express";
import { and, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  doctorsTable,
  doctorInsurancesTable,
  patientsTable,
  patientClinicsTable,
  clinicOwnersTable,
  professionalAvailabilityTable,
  professionalLunchBreaksTable,
  appointmentsTable,
  appointmentReviewsTable,
  staffEventsTable,
  type Appointment as AppointmentRow,
} from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId, resolveSecretaryClinicId } from "../lib/auth-helpers";
import {
  SetDoctorAvailabilityBody,
  CreateAppointmentBody,
  UpdateAppointmentBody,
  CreateAppointmentReviewBody,
} from "@workspace/api-zod";
import { hashAppointmentConfirmationToken } from "../lib/appointmentConfirmation";
import { buildAppointmentSlots, minutesToTime, timeToMinutes, weekdayFromDateString } from "../lib/appointmentSlots";

const router = Router();

function sendConfirmationPage(
  res: Response,
  title: string,
  message: string,
  token?: string,
  status = 200
): void {
  const form = token
    ? `<form method="post" action="/api/appointments/confirm"><input type="hidden" name="token" value="${token}" /><button type="submit">Confirmar consulta</button></form>`
    : "";
  res
    .status(status)
    .set("Cache-Control", "no-store")
    .type("html")
    .send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Arial,sans-serif;max-width:560px;margin:48px auto;padding:24px;color:#1f2937"><h1>${title}</h1><p>${message}</p>${form}</body></html>`);
}

function isValidConfirmationToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

async function findConfirmationAppointment(token: string) {
  const [appointment] = await db
    .select({
      id: appointmentsTable.id,
      status: appointmentsTable.status,
      confirmedAt: appointmentsTable.confirmedAt,
      isUpcoming: sql<boolean>`(${appointmentsTable.date}::date + ${appointmentsTable.startTime}::time) > now()`,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.confirmationTokenHash, hashAppointmentConfirmationToken(token)))
    .limit(1);
  return appointment;
}

router.get("/appointments/confirm", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!isValidConfirmationToken(token)) {
    sendConfirmationPage(res, "Link inválido", "Este link de confirmação é inválido ou expirou.", undefined, 400);
    return;
  }

  const appointment = await findConfirmationAppointment(token);
  if (!appointment) {
    sendConfirmationPage(res, "Link inválido", "Este link de confirmação é inválido ou expirou.", undefined, 410);
    return;
  }
  if (appointment.confirmedAt) {
    sendConfirmationPage(res, "Consulta confirmada", "Sua presença já foi confirmada.");
    return;
  }
  if (appointment.status !== "scheduled" || !appointment.isUpcoming) {
    sendConfirmationPage(res, "Confirmação indisponível", "Esta consulta não pode mais ser confirmada.", undefined, 410);
    return;
  }

  sendConfirmationPage(res, "Confirme sua consulta", "Clique abaixo para confirmar sua presença.", token);
});

router.post("/appointments/confirm", async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!isValidConfirmationToken(token)) {
    sendConfirmationPage(res, "Link inválido", "Este link de confirmação é inválido ou expirou.", undefined, 400);
    return;
  }

  const appointment = await findConfirmationAppointment(token);
  if (!appointment) {
    sendConfirmationPage(res, "Link inválido", "Este link de confirmação é inválido ou expirou.", undefined, 410);
    return;
  }
  if (appointment.confirmedAt) {
    sendConfirmationPage(res, "Consulta confirmada", "Sua presença já foi confirmada.");
    return;
  }
  if (appointment.status !== "scheduled" || !appointment.isUpcoming) {
    sendConfirmationPage(res, "Confirmação indisponível", "Esta consulta não pode mais ser confirmada.", undefined, 410);
    return;
  }

  const [confirmed] = await db
    .update(appointmentsTable)
    .set({ confirmedAt: new Date() })
    .where(
      and(
        eq(appointmentsTable.id, appointment.id),
        eq(appointmentsTable.status, "scheduled"),
        isNull(appointmentsTable.confirmedAt),
        eq(appointmentsTable.confirmationTokenHash, hashAppointmentConfirmationToken(token)),
        sql`(${appointmentsTable.date}::date + ${appointmentsTable.startTime}::time) > now()`
      )
    )
    .returning({ id: appointmentsTable.id });

  sendConfirmationPage(
    res,
    confirmed ? "Consulta confirmada" : "Confirmação indisponível",
    confirmed
      ? "Sua presença foi confirmada com sucesso."
      : "Esta consulta já foi confirmada ou não pode mais ser confirmada.",
    undefined,
    confirmed ? 200 : 410
  );
});

const appointmentStatusLabelsForEvent: Record<string, string> = {
  scheduled: "agendada",
  completed: "concluída",
  cancelled: "cancelada",
};

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
type Weekday = (typeof WEEKDAYS)[number];

/**
 * Resolve the effective clinic ID for the current caller, regardless of role.
 * Returns null when the caller has no resolvable clinic.
 */
async function resolveCallerClinicId(
  user: { id: number; role: string },
  jwtClinicId?: number
): Promise<number | null> {
  if (user.role === "clinic_owner") {
    return (await resolveOwnerClinicId(user.id, jwtClinicId)) ?? null;
  }
  if (user.role === "profissional_saude") {
    const [doc] = await db
      .select({ clinicId: doctorsTable.clinicId })
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    return doc?.clinicId ?? null;
  }
  if (user.role === "patient") {
    const [patient] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, user.id))
      .limit(1);
    if (!patient) return null;
    const [enrollment] = await db
      .select({ clinicId: patientClinicsTable.clinicId })
      .from(patientClinicsTable)
      .where(eq(patientClinicsTable.patientId, patient.id))
      .limit(1);
    return enrollment?.clinicId ?? null;
  }
  if (user.role === "secretaria") {
    return (await resolveSecretaryClinicId(user.id, jwtClinicId)) ?? null;
  }
  return null;
}

async function buildAppointmentResponse(appt: AppointmentRow) {
  const [patientRow] = await db
    .select({ name: usersTable.name })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(eq(patientsTable.id, appt.patientId))
    .limit(1);
  const [doctorRow] = await db
    .select({ name: usersTable.name, consultationPrice: doctorsTable.consultationPrice })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(eq(doctorsTable.id, appt.doctorId))
    .limit(1);
  const [reviewRow] = await db
    .select()
    .from(appointmentReviewsTable)
    .where(eq(appointmentReviewsTable.appointmentId, appt.id))
    .limit(1);

  let insuranceName: string | null = appt.insuranceName ?? null;
  let priceAmount: number | null = null;
  if (appt.priceType === "convenio" && appt.doctorInsuranceId) {
    const [insuranceRow] = await db
      .select()
      .from(doctorInsurancesTable)
      .where(eq(doctorInsurancesTable.id, appt.doctorInsuranceId))
      .limit(1);
    if (insuranceRow) {
      insuranceName = insuranceRow.name;
      priceAmount = Number(insuranceRow.price);
    }
  } else if (appt.priceType === "particular" && doctorRow?.consultationPrice != null) {
    priceAmount = Number(doctorRow.consultationPrice);
  }

  return {
    id: appt.id,
    patientId: appt.patientId,
    patientName: patientRow?.name ?? "",
    doctorId: appt.doctorId,
    doctorName: doctorRow?.name ?? "",
    clinicId: appt.clinicId,
    date: appt.date,
    startTime: appt.startTime,
    endTime: appt.endTime,
    status: appt.status,
    confirmationStatus: appt.confirmedAt ? "confirmed" : appt.confirmationSentAt ? "pending" : null,
    modality: appt.modality,
    meetingLink: appt.meetingLink ?? null,
    cancelReason: appt.cancelReason ?? null,
    priceType: appt.priceType ?? null,
    doctorInsuranceId: appt.doctorInsuranceId ?? null,
    insuranceName,
    priceAmount,
    amountCharged: appt.amountCharged != null ? Number(appt.amountCharged) : null,
    paymentMethod: appt.paymentMethod ?? null,
    createdAt: appt.createdAt.toISOString(),
    isPaid: appt.isPaid,
    paidBy: appt.paidBy ?? null,
    paymentNotes: appt.paymentNotes ?? null,
    paymentProofUrl: appt.paymentProofUrl ?? null,
    paymentRecordedAt: appt.paymentRecordedAt ? appt.paymentRecordedAt.toISOString() : null,
    paymentRecordedByUserId: appt.paymentRecordedByUserId ?? null,
    review: reviewRow
      ? {
          id: reviewRow.id,
          appointmentId: reviewRow.appointmentId,
          patientId: reviewRow.patientId,
          patientName: patientRow?.name ?? "",
          doctorId: reviewRow.doctorId,
          rating: reviewRow.rating,
          comment: reviewRow.comment ?? null,
          createdAt: reviewRow.createdAt.toISOString(),
        }
      : null,
  };
}

// ── Availability ────────────────────────────────────────────────────────────

async function getAvailabilitySettings(doctorId: number) {
  const [windows, lunchBreaks] = await Promise.all([
    db.select().from(professionalAvailabilityTable).where(eq(professionalAvailabilityTable.doctorId, doctorId)),
    db.select().from(professionalLunchBreaksTable).where(eq(professionalLunchBreaksTable.doctorId, doctorId)),
  ]);
  return {
    windows: windows.map((window) => ({
      id: window.id,
      doctorId: window.doctorId,
      dayOfWeek: window.dayOfWeek,
      startTime: window.startTime,
      endTime: window.endTime,
      slotDurationMinutes: window.slotDurationMinutes,
    })),
    lunchBreaks: lunchBreaks.map((breakTime) => ({
      dayOfWeek: breakTime.dayOfWeek,
      startTime: breakTime.startTime,
      endTime: breakTime.endTime,
    })),
  };
}

router.get("/doctors/:doctorId/availability", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const doctorId = parseInt(raw, 10);

  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (!doctor) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }

  const callerClinicId = await resolveCallerClinicId(authResult.user, authResult.clinicId);
  if (callerClinicId === null || callerClinicId !== doctor.clinicId) {
    res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
    return;
  }

  res.json(await getAvailabilitySettings(doctorId));
});

router.put("/doctors/:doctorId/availability", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  if (user.role !== "profissional_saude" && user.role !== "secretaria" && user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas profissionais, secretárias e administradores podem configurar agendas." });
    return;
  }

  const raw = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const doctorId = parseInt(raw, 10);

  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (!doctor) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }

  if (user.role === "profissional_saude") {
    if (doctor.userId !== user.id) {
      res.status(403).json({ error: "Você só pode configurar a sua própria agenda." });
      return;
    }
  } else {
    // secretaria / clinic_owner may configure any professional's agenda,
    // but only within their own clinic.
    const callerClinicId = await resolveCallerClinicId(user, authResult.clinicId);
    if (callerClinicId === null || callerClinicId !== doctor.clinicId) {
      res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
      return;
    }
  }

  const parsed = SetDoctorAvailabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  for (const w of parsed.data.windows) {
    if (timeToMinutes(w.startTime) >= timeToMinutes(w.endTime)) {
      res.status(400).json({ error: `Janela inválida: ${w.startTime} deve ser antes de ${w.endTime}` });
      return;
    }
  }

  const configuredDays = new Set(parsed.data.windows.map((window) => window.dayOfWeek));
  const lunchDays = new Set<string>();
  for (const lunchBreak of parsed.data.lunchBreaks) {
    if (!configuredDays.has(lunchBreak.dayOfWeek)) {
      res.status(400).json({ error: "O intervalo de almoço deve corresponder a um dia de atendimento." });
      return;
    }
    if (lunchDays.has(lunchBreak.dayOfWeek)) {
      res.status(400).json({ error: "Configure apenas um intervalo de almoço por dia." });
      return;
    }
    lunchDays.add(lunchBreak.dayOfWeek);
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(lunchBreak.startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(lunchBreak.endTime) ||
      timeToMinutes(lunchBreak.endTime) - timeToMinutes(lunchBreak.startTime) !== 60
    ) {
      res.status(400).json({ error: "O intervalo de almoço deve ter exatamente uma hora." });
      return;
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(professionalAvailabilityTable).where(eq(professionalAvailabilityTable.doctorId, doctorId));
    await tx.delete(professionalLunchBreaksTable).where(eq(professionalLunchBreaksTable.doctorId, doctorId));
    if (parsed.data.windows.length > 0) {
      await tx.insert(professionalAvailabilityTable).values(
        parsed.data.windows.map((w) => ({
          doctorId,
          dayOfWeek: w.dayOfWeek,
          startTime: w.startTime,
          endTime: w.endTime,
          slotDurationMinutes: w.slotDurationMinutes ?? 30,
        }))
      );
    }
    if (parsed.data.lunchBreaks.length > 0) {
      await tx.insert(professionalLunchBreaksTable).values(
        parsed.data.lunchBreaks.map((lunchBreak) => ({
          doctorId,
          dayOfWeek: lunchBreak.dayOfWeek,
          startTime: lunchBreak.startTime,
          endTime: lunchBreak.endTime,
        }))
      );
    }
  });

  res.json(await getAvailabilitySettings(doctorId));
});

// ── Slots ────────────────────────────────────────────────────────────────────

router.get("/doctors/:doctorId/slots", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const doctorId = parseInt(raw, 10);
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Parâmetro date (YYYY-MM-DD) é obrigatório" });
    return;
  }

  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (!doctor) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }

  const callerClinicId = await resolveCallerClinicId(authResult.user, authResult.clinicId);
  if (callerClinicId === null || callerClinicId !== doctor.clinicId) {
    res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
    return;
  }

  const weekday = weekdayFromDateString(date);
  const windows = await db
    .select()
    .from(professionalAvailabilityTable)
    .where(
      and(eq(professionalAvailabilityTable.doctorId, doctorId), eq(professionalAvailabilityTable.dayOfWeek, weekday))
    );

  if (windows.length === 0) {
    res.json([]);
    return;
  }

  const bookedRows = await db
    .select({ startTime: appointmentsTable.startTime, endTime: appointmentsTable.endTime })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.doctorId, doctorId),
        eq(appointmentsTable.date, date),
        ne(appointmentsTable.status, "cancelled")
      )
    );
  const lunchBreaks = await db
    .select({ startTime: professionalLunchBreaksTable.startTime, endTime: professionalLunchBreaksTable.endTime })
    .from(professionalLunchBreaksTable)
    .where(
      and(
        eq(professionalLunchBreaksTable.doctorId, doctorId),
        eq(professionalLunchBreaksTable.dayOfWeek, weekday)
      )
    );
  res.json(buildAppointmentSlots(windows, bookedRows, lunchBreaks));
});

/**
 * Validates that `startTime` falls inside one of `doctorId`'s availability
 * windows on `date`, that the slot is not already booked by that doctor
 * (excluding `excludeAppointmentId`, used when rescheduling), and that
 * `patientId` has no other overlapping scheduled appointment that day
 * (excluding `excludeAppointmentId`). Returns the resolved `endTime` on
 * success, or an error message on failure.
 */
async function resolveAndValidateSlot(params: {
  doctorId: number;
  date: string;
  startTime: string;
  patientId: number;
  excludeAppointmentId?: number;
}): Promise<{ endTime: string } | { error: string }> {
  const { doctorId, date, startTime, patientId, excludeAppointmentId } = params;

  const weekday = weekdayFromDateString(date);
  const windows = await db
    .select()
    .from(professionalAvailabilityTable)
    .where(
      and(eq(professionalAvailabilityTable.doctorId, doctorId), eq(professionalAvailabilityTable.dayOfWeek, weekday))
    );

  const slotMinutes = timeToMinutes(startTime);
  const matchingWindow = windows.find((w) => {
    const start = timeToMinutes(w.startTime);
    const end = timeToMinutes(w.endTime);
    return slotMinutes >= start && slotMinutes + w.slotDurationMinutes <= end && (slotMinutes - start) % w.slotDurationMinutes === 0;
  });
  if (!matchingWindow) {
    return { error: "Este horário não está disponível na agenda do profissional." };
  }

  const endTime = minutesToTime(slotMinutes + matchingWindow.slotDurationMinutes);
  const [lunchBreak] = await db
    .select()
    .from(professionalLunchBreaksTable)
    .where(
      and(
        eq(professionalLunchBreaksTable.doctorId, doctorId),
        eq(professionalLunchBreaksTable.dayOfWeek, weekday)
      )
    )
    .limit(1);
  if (
    lunchBreak &&
    slotMinutes < timeToMinutes(lunchBreak.endTime) &&
    timeToMinutes(endTime) > timeToMinutes(lunchBreak.startTime)
  ) {
    return { error: "Este horário está dentro do intervalo de almoço do profissional." };
  }

  const doctorBookedConditions = [
    eq(appointmentsTable.doctorId, doctorId),
    eq(appointmentsTable.date, date),
    eq(appointmentsTable.startTime, startTime),
    ne(appointmentsTable.status, "cancelled"),
  ];
  if (excludeAppointmentId) {
    doctorBookedConditions.push(ne(appointmentsTable.id, excludeAppointmentId));
  }
  const [existing] = await db
    .select()
    .from(appointmentsTable)
    .where(and(...doctorBookedConditions))
    .limit(1);
  if (existing) {
    return { error: "Este horário acabou de ser reservado. Escolha outro horário." };
  }

  // One-appointment-per-day rule: a patient may only have one non-cancelled
  // appointment on a given date, regardless of time or professional.
  const sameDayConditions = [
    eq(appointmentsTable.patientId, patientId),
    eq(appointmentsTable.date, date),
    ne(appointmentsTable.status, "cancelled"),
  ];
  if (excludeAppointmentId) {
    sameDayConditions.push(ne(appointmentsTable.id, excludeAppointmentId));
  }
  const [existingSameDay] = await db
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(and(...sameDayConditions))
    .limit(1);
  if (existingSameDay) {
    return { error: "Você já possui uma consulta agendada para este dia." };
  }

  return { endTime };
}

/**
 * Validates and resolves the optional price type and insurance details for a
 * booking/edit. Registered plans must belong to the appointment's doctor;
 * otherwise a free-text insurance name is required for "convenio".
 * Passing `priceType: "particular"` clears any previously set insurance.
 * Returns the resolved (possibly null) values, or an error message.
 */
async function resolveAppointmentPricing(
  doctor: { id: number },
  priceType: "particular" | "convenio" | undefined,
  doctorInsuranceId: number | undefined,
  requestedInsuranceName: string | undefined
): Promise<{ priceType: "particular" | "convenio" | null; doctorInsuranceId: number | null; insuranceName: string | null } | { error: string }> {
  if (priceType === undefined) {
    return { priceType: null, doctorInsuranceId: null, insuranceName: null };
  }
  if (priceType === "particular") {
    return { priceType: "particular", doctorInsuranceId: null, insuranceName: null };
  }
  // priceType === "convenio"
  if (doctorInsuranceId) {
    const [insuranceRow] = await db
      .select()
      .from(doctorInsurancesTable)
      .where(and(eq(doctorInsurancesTable.id, doctorInsuranceId), eq(doctorInsurancesTable.doctorId, doctor.id)))
      .limit(1);
    if (!insuranceRow) {
      return { error: "Este convênio não pertence ao profissional selecionado." };
    }
    return { priceType: "convenio", doctorInsuranceId: insuranceRow.id, insuranceName: null };
  }

  const insuranceName = requestedInsuranceName?.trim();
  if (!insuranceName) {
    return { error: "Informe o nome do convênio." };
  }
  return { priceType: "convenio", doctorInsuranceId: null, insuranceName };
}

// ── Appointments ─────────────────────────────────────────────────────────────

router.get("/appointments", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  const statusFilter = req.query.status as "scheduled" | "cancelled" | "completed" | undefined;
  const doctorIdFilterRaw = req.query.doctorId as string | undefined;

  let conditions;
  if (user.role === "patient") {
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    if (!patient) {
      res.json([]);
      return;
    }
    conditions = eq(appointmentsTable.patientId, patient.id);
  } else if (user.role === "profissional_saude" || user.role === "clinic_owner" || user.role === "secretaria") {
    // Professionals, secretaries, and clinic owners all see the full clinic
    // agenda (read access). Edit permissions are enforced separately on the
    // PUT availability / DELETE appointment endpoints.
    const effectiveClinicId = await resolveCallerClinicId(user, authResult.clinicId);
    if (!effectiveClinicId) {
      res.json([]);
      return;
    }
    conditions = eq(appointmentsTable.clinicId, effectiveClinicId);
    if (doctorIdFilterRaw) {
      const doctorIdFilter = parseInt(doctorIdFilterRaw, 10);
      if (!Number.isNaN(doctorIdFilter)) {
        conditions = and(conditions, eq(appointmentsTable.doctorId, doctorIdFilter));
      }
    }
  } else {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(statusFilter ? and(conditions, eq(appointmentsTable.status, statusFilter)) : conditions)
    .orderBy(appointmentsTable.date, appointmentsTable.startTime);

  const results = await Promise.all(rows.map(buildAppointmentResponse));
  res.json(results);
});

router.post("/appointments", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  const isStaffBooking = user.role === "secretaria" || user.role === "clinic_owner";
  if (user.role !== "patient" && !isStaffBooking) {
    res.status(403).json({ error: "Apenas pacientes, secretárias e administradores podem marcar consultas." });
    return;
  }

  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { doctorId } = parsed.data;
  const date =
    parsed.data.date instanceof Date ? parsed.data.date.toISOString().split("T")[0] : String(parsed.data.date);
  const { startTime } = parsed.data;
  // Only staff (secretaria/clinic_owner) may set modality/link at creation time;
  // patient self-bookings always default to presencial (same as before this change).
  const modality = isStaffBooking ? (parsed.data.modality ?? "presencial") : "presencial";
  if (modality === "presencial" && parsed.data.meetingLink) {
    res.status(400).json({ error: "Link de reunião só é permitido para teleconsultas." });
    return;
  }
  const meetingLink = modality === "teleconsulta" ? (parsed.data.meetingLink ?? null) : null;

  let patient: { id: number; paymentType: string; insuranceName: string | null };
  if (isStaffBooking) {
    if (!parsed.data.patientId) {
      res.status(400).json({ error: "patientId é obrigatório para marcar consulta em nome de um paciente." });
      return;
    }
    const [patientRow] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.id, parsed.data.patientId))
      .limit(1);
    if (!patientRow) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    patient = patientRow;
  } else {
    const [patientRow] = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    if (!patientRow) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    patient = patientRow;
  }

  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (!doctor) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }

  if (isStaffBooking) {
    // Multi-tenant isolation: both the professional and the patient must belong
    // to the caller's own clinic.
    const callerClinicId = await resolveCallerClinicId(user, authResult.clinicId);
    if (callerClinicId === null || callerClinicId !== doctor.clinicId) {
      res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
      return;
    }
    const [enrollment] = await db
      .select()
      .from(patientClinicsTable)
      .where(and(eq(patientClinicsTable.patientId, patient.id), eq(patientClinicsTable.clinicId, callerClinicId)))
      .limit(1);
    if (!enrollment) {
      res.status(403).json({ error: "Este paciente não pertence à sua clínica." });
      return;
    }
  } else {
    // Multi-tenant isolation: the professional must belong to the patient's own clinic.
    const [enrollment] = await db
      .select()
      .from(patientClinicsTable)
      .where(and(eq(patientClinicsTable.patientId, patient.id), eq(patientClinicsTable.clinicId, doctor.clinicId)))
      .limit(1);
    if (!enrollment) {
      res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
      return;
    }
  }

  const slotResult = await resolveAndValidateSlot({ doctorId, date, startTime, patientId: patient.id });
  if ("error" in slotResult) {
    res.status(409).json({ error: slotResult.error });
    return;
  }
  const { endTime } = slotResult;

  const priceResult = await resolveAppointmentPricing(
    doctor,
    parsed.data.priceType,
    parsed.data.doctorInsuranceId,
    parsed.data.insuranceName,
  );
  if ("error" in priceResult) {
    res.status(400).json({ error: priceResult.error });
    return;
  }

  // Auto-populate the amount charged from the professional's already-registered
  // pricing: their flat consultationPrice for particular-billing patients, or the
  // price registered for the patient's insurance provider for convenio patients.
  // Based on the patient's general `paymentType` (their billing arrangement), which
  // is independent of the per-appointment `priceType` selection resolved above.
  let amountCharged: string | null = null;
  const isConvenio = patient.paymentType === "convenio";
  if (isConvenio) {
    if (!priceResult.insuranceName) {
      const insuranceRows = await db
        .select()
        .from(doctorInsurancesTable)
        .where(eq(doctorInsurancesTable.doctorId, doctorId));
      const matched = patient.insuranceName
        ? insuranceRows.find(
            (row) => row.name.trim().toLowerCase() === patient.insuranceName!.trim().toLowerCase()
          )
        : undefined;
      amountCharged = (matched ?? insuranceRows[0])?.price ?? null;
    }
  } else {
    amountCharged = doctor.consultationPrice ?? null;
  }

  let created: AppointmentRow;
  try {
    const [row] = await db
      .insert(appointmentsTable)
      .values({
        patientId: patient.id,
        doctorId,
        clinicId: doctor.clinicId,
        date,
        startTime,
        endTime,
        status: "scheduled",
        modality,
        meetingLink,
        priceType: priceResult.priceType,
        doctorInsuranceId: priceResult.doctorInsuranceId,
        insuranceName: priceResult.insuranceName,
        amountCharged,
      })
      .returning();
    created = row;
  } catch (err) {
    // The unique constraint on (doctorId, date, startTime) is the last line of
    // defense against a race between the availability check above and the insert.
    res.status(409).json({ error: "Este horário acabou de ser reservado. Escolha outro horário." });
    return;
  }

  const [patientUser] = await db.select().from(usersTable).where(eq(usersTable.id, authResult.user.id)).limit(1);
  const [doctorUser] = await db.select().from(usersTable).where(eq(usersTable.id, doctor.userId)).limit(1);
  await db.insert(staffEventsTable).values({
    userId: authResult.user.id,
    clinicId: created.clinicId,
    type: "appointment_booked",
    description: `${patientUser?.name ?? "Paciente"} agendou consulta com ${doctorUser?.name ?? "profissional"} em ${date} às ${startTime}`,
  });

  const result = await buildAppointmentResponse(created);
  res.status(201).json(result);
});

router.patch("/appointments/:appointmentId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const raw = Array.isArray(req.params.appointmentId) ? req.params.appointmentId[0] : req.params.appointmentId;
  const appointmentId = parseInt(raw, 10);

  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId)).limit(1);
  if (!appt) {
    res.status(404).json({ error: "Consulta não encontrada" });
    return;
  }

  // Only clinic staff (secretaria, clinic_owner) and the currently assigned
  // professional may edit an appointment. Patients cannot reschedule/reassign
  // via this endpoint (they can cancel + rebook instead).
  let authorized = false;
  let callerDoctor: { id: number } | undefined;
  if (user.role === "profissional_saude") {
    const [doc] = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, user.id)).limit(1);
    callerDoctor = doc;
    authorized = !!doc && doc.id === appt.doctorId;
  } else if (user.role === "clinic_owner" || user.role === "secretaria") {
    const effectiveClinicId = await resolveCallerClinicId(user, authResult.clinicId);
    authorized = !!effectiveClinicId && effectiveClinicId === appt.clinicId;
  }
  if (!authorized) {
    res.status(403).json({ error: "Você não tem acesso a esta consulta." });
    return;
  }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Financial fields (billing) can only be set by clinic staff who manage
  // the cash flow, not by the treating professional.
  const touchesFinancialFields =
    parsed.data.amountCharged !== undefined ||
    parsed.data.isPaid !== undefined ||
    parsed.data.paymentMethod !== undefined;
  if (touchesFinancialFields && user.role !== "clinic_owner" && user.role !== "secretaria") {
    res.status(403).json({ error: "Apenas a secretaria ou o proprietário podem alterar dados financeiros." });
    return;
  }

  const nextDoctorId = parsed.data.doctorId ?? appt.doctorId;
  const nextDate =
    parsed.data.date instanceof Date ? parsed.data.date.toISOString().split("T")[0] : (parsed.data.date ?? appt.date);
  const nextStartTime = parsed.data.startTime ?? appt.startTime;
  const nextStatus = parsed.data.status ?? appt.status;
  const nextModality = parsed.data.modality ?? appt.modality;
  if (nextModality === "presencial" && parsed.data.meetingLink) {
    res.status(400).json({ error: "Link de reunião só é permitido para teleconsultas." });
    return;
  }
  const nextMeetingLink =
    nextModality === "presencial"
      ? null
      : parsed.data.meetingLink !== undefined
        ? parsed.data.meetingLink
        : appt.meetingLink;
  const nextAmountCharged =
    parsed.data.amountCharged !== undefined
      ? parsed.data.amountCharged != null
        ? parsed.data.amountCharged.toString()
        : null
      : appt.amountCharged;

  // Payment fields: only secretaria, clinic_owner, or the assigned professional
  // may record/edit payment info (same `authorized` check as the rest of this
  // endpoint already enforces that set of roles).
  const isPaymentUpdate =
    parsed.data.isPaid !== undefined ||
    parsed.data.paymentMethod !== undefined ||
    parsed.data.paidBy !== undefined ||
    parsed.data.paymentNotes !== undefined ||
    parsed.data.paymentProofUrl !== undefined;
  const nextIsPaid = parsed.data.isPaid ?? appt.isPaid;
  const nextPaymentMethod = parsed.data.paymentMethod !== undefined ? parsed.data.paymentMethod : appt.paymentMethod;
  const nextPaidBy = parsed.data.paidBy !== undefined ? parsed.data.paidBy : appt.paidBy;
  const nextPaymentNotes = parsed.data.paymentNotes !== undefined ? parsed.data.paymentNotes : appt.paymentNotes;
  const nextPaymentProofUrl =
    parsed.data.paymentProofUrl !== undefined ? parsed.data.paymentProofUrl : appt.paymentProofUrl;

  const isReschedule = nextDoctorId !== appt.doctorId || nextDate !== appt.date || nextStartTime !== appt.startTime;

  let nextClinicId = appt.clinicId;
  let nextEndTime = appt.endTime;

  if (isReschedule) {
    const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, nextDoctorId)).limit(1);
    if (!doctor) {
      res.status(404).json({ error: "Profissional não encontrado" });
      return;
    }
    // Multi-tenant isolation: the new professional must be in the same clinic
    // as the appointment being edited.
    if (doctor.clinicId !== appt.clinicId) {
      res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
      return;
    }
    // A professional (not staff) may only reassign an appointment to themselves,
    // never to a colleague.
    if (user.role === "profissional_saude" && callerDoctor && nextDoctorId !== callerDoctor.id) {
      res.status(403).json({ error: "Você só pode atribuir a consulta a si mesmo." });
      return;
    }

    const slotResult = await resolveAndValidateSlot({
      doctorId: nextDoctorId,
      date: nextDate,
      startTime: nextStartTime,
      patientId: appt.patientId,
      excludeAppointmentId: appt.id,
    });
    if ("error" in slotResult) {
      res.status(409).json({ error: slotResult.error });
      return;
    }
    nextEndTime = slotResult.endTime;
    nextClinicId = doctor.clinicId;
  }

  let nextPriceType = appt.priceType;
  let nextDoctorInsuranceId = appt.doctorInsuranceId;
  let nextInsuranceName = appt.insuranceName;
  if (parsed.data.priceType !== undefined) {
    const [priceDoctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, nextDoctorId)).limit(1);
    if (!priceDoctor) {
      res.status(404).json({ error: "Profissional não encontrado" });
      return;
    }
    const priceResult = await resolveAppointmentPricing(
      priceDoctor,
      parsed.data.priceType,
      parsed.data.doctorInsuranceId,
      parsed.data.insuranceName,
    );
    if ("error" in priceResult) {
      res.status(400).json({ error: priceResult.error });
      return;
    }
    nextPriceType = priceResult.priceType;
    nextDoctorInsuranceId = priceResult.doctorInsuranceId;
    nextInsuranceName = priceResult.insuranceName;
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set({
      doctorId: nextDoctorId,
      clinicId: nextClinicId,
      date: nextDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      status: nextStatus,
      isPaid: nextIsPaid,
      paymentMethod: nextPaymentMethod,
      paidBy: nextPaidBy,
      paymentNotes: nextPaymentNotes,
      paymentProofUrl: nextPaymentProofUrl,
      ...(isPaymentUpdate ? { paymentRecordedAt: new Date(), paymentRecordedByUserId: user.id } : {}),
      modality: nextModality,
      meetingLink: nextMeetingLink,
      priceType: nextPriceType,
      doctorInsuranceId: nextDoctorInsuranceId,
      insuranceName: nextInsuranceName,
      amountCharged: nextAmountCharged,
      ...(nextDoctorId !== appt.doctorId || nextDate !== appt.date || nextStartTime !== appt.startTime
        ? { confirmationTokenHash: null, confirmationSentAt: null, confirmedAt: null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, appointmentId))
    .returning();

  const [patientUser] = await db
    .select({ name: usersTable.name })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(eq(patientsTable.id, appt.patientId))
    .limit(1);
  const [newDoctorUser] = await db
    .select({ name: usersTable.name })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(eq(doctorsTable.id, nextDoctorId))
    .limit(1);
  await db.insert(staffEventsTable).values({
    userId: user.id,
    type: "appointment_updated",
    description: `Consulta de ${patientUser?.name ?? "paciente"} com ${newDoctorUser?.name ?? "profissional"} atualizada para ${nextDate} às ${nextStartTime} (${appointmentStatusLabelsForEvent[nextStatus] ?? nextStatus})`,
  });

  const result = await buildAppointmentResponse(updated);
  res.json(result);
});

router.delete("/appointments/:appointmentId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.appointmentId) ? req.params.appointmentId[0] : req.params.appointmentId;
  const appointmentId = parseInt(raw, 10);

  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId)).limit(1);
  if (!appt) {
    res.status(404).json({ error: "Consulta não encontrada" });
    return;
  }

  const { user } = authResult;
  let authorized = false;
  if (user.role === "patient") {
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
    authorized = !!patient && patient.id === appt.patientId;
  } else if (user.role === "profissional_saude") {
    const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, user.id)).limit(1);
    authorized = !!doctor && doctor.id === appt.doctorId;
  } else if (user.role === "clinic_owner" || user.role === "secretaria") {
    const effectiveClinicId = await resolveCallerClinicId(user, authResult.clinicId);
    authorized = !!effectiveClinicId && effectiveClinicId === appt.clinicId;
  }
  if (!authorized) {
    res.status(403).json({ error: "Você não tem acesso a esta consulta." });
    return;
  }

  if (appt.status === "cancelled") {
    res.status(204).send();
    return;
  }

  await db
    .update(appointmentsTable)
    .set({ status: "cancelled", cancelledByUserId: user.id, updatedAt: new Date() })
    .where(eq(appointmentsTable.id, appointmentId));

  const [patientUser] = await db
    .select({ name: usersTable.name })
    .from(patientsTable)
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(eq(patientsTable.id, appt.patientId))
    .limit(1);
  const [doctorUser] = await db
    .select({ name: usersTable.name })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(eq(doctorsTable.id, appt.doctorId))
    .limit(1);
  await db.insert(staffEventsTable).values({
    userId: user.id,
    clinicId: appt.clinicId,
    type: "appointment_cancelled",
    description: `Consulta de ${patientUser?.name ?? "paciente"} com ${doctorUser?.name ?? "profissional"} em ${appt.date} às ${appt.startTime} foi cancelada`,
  });

  res.status(204).send();
});

router.post("/appointments/:appointmentId/review", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem avaliar consultas." });
    return;
  }

  const raw = Array.isArray(req.params.appointmentId) ? req.params.appointmentId[0] : req.params.appointmentId;
  const appointmentId = parseInt(raw, 10);

  const parsed = CreateAppointmentReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId)).limit(1);
  if (!appt) {
    res.status(404).json({ error: "Consulta não encontrada" });
    return;
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authResult.user.id)).limit(1);
  if (!patient || patient.id !== appt.patientId) {
    res.status(403).json({ error: "Você não tem acesso a esta consulta." });
    return;
  }

  if (appt.status !== "completed") {
    res.status(409).json({ error: "Só é possível avaliar consultas concluídas." });
    return;
  }

  const [existingReview] = await db
    .select()
    .from(appointmentReviewsTable)
    .where(eq(appointmentReviewsTable.appointmentId, appointmentId))
    .limit(1);
  if (existingReview) {
    res.status(409).json({ error: "Esta consulta já foi avaliada." });
    return;
  }

  const [review] = await db
    .insert(appointmentReviewsTable)
    .values({
      appointmentId,
      patientId: patient.id,
      doctorId: appt.doctorId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    })
    .returning();

  const [patientUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, authResult.user.id)).limit(1);

  res.status(201).json({
    id: review.id,
    appointmentId: review.appointmentId,
    patientId: review.patientId,
    patientName: patientUser?.name ?? "",
    doctorId: review.doctorId,
    rating: review.rating,
    comment: review.comment ?? null,
    createdAt: review.createdAt.toISOString(),
  });
});

export default router;
