import { pgTable, serial, integer, text, pgEnum, timestamp, date, unique, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { doctorsTable, doctorInsurancesTable } from "./doctors";
import { patientsTable, paymentTypeEnum } from "./patients";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const weekdayEnum = pgEnum("weekday", [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "cancelled",
  "completed",
]);

// How the patient (or whoever paid) settled the appointment. Separate from
// `paymentTypeEnum` on `patients` (particular/convenio), which describes the
// patient's general billing arrangement rather than a specific transaction.
export const appointmentPaymentMethodEnum = pgEnum("appointment_payment_method", [
  "dinheiro",
  "cartao",
  "pix",
  "convenio",
  "outro",
]);

export const appointmentModalityEnum = pgEnum("appointment_modality", [
  "presencial",
  "teleconsulta",
]);

// Recurring weekly availability windows for a professional. `startTime`/`endTime`
// are stored as "HH:MM" strings (24h) rather than timestamps since they repeat
// every week and are not tied to a specific date.
export const professionalAvailabilityTable = pgTable("professional_availability", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "cascade" }),
  dayOfWeek: weekdayEnum("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  slotDurationMinutes: integer("slot_duration_minutes").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProfessionalAvailabilitySchema = createInsertSchema(professionalAvailabilityTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfessionalAvailability = z.infer<typeof insertProfessionalAvailabilitySchema>;
export type ProfessionalAvailability = typeof professionalAvailabilityTable.$inferSelect;

export const professionalLunchBreaksTable = pgTable(
  "professional_lunch_breaks",
  {
    id: serial("id").primaryKey(),
    doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "cascade" }),
    dayOfWeek: weekdayEnum("day_of_week").notNull(),
    startTime: text("start_time").notNull().default("12:00"),
    endTime: text("end_time").notNull().default("13:00"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("professional_lunch_breaks_doctor_day_unique").on(table.doctorId, table.dayOfWeek)]
);

// A booked appointment. `date` is stored as an ISO date string (YYYY-MM-DD);
// `startTime`/`endTime` are "HH:MM" strings, matching the availability model above.
export const appointmentsTable = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
    doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "cascade" }),
    clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    status: appointmentStatusEnum("status").notNull().default("scheduled"),
    modality: appointmentModalityEnum("modality").notNull().default("presencial"),
    meetingLink: text("meeting_link"),
    cancelledByUserId: integer("cancelled_by_user_id"),
    cancelReason: text("cancel_reason"),
    // Which price applies to this appointment: "particular" (the doctor's
    // private consultation price) or "convenio" (a specific insurance plan,
    // identified by doctorInsuranceId or the free-text insuranceName below).
    // Both are optional/read-only for now — they don't feed billing/financial
    // reports yet.
    priceType: paymentTypeEnum("price_type"),
    doctorInsuranceId: integer("doctor_insurance_id").references(() => doctorInsurancesTable.id, {
      onDelete: "set null",
    }),
    insuranceName: text("insurance_name"),
    // Set once the server-side push reminder job has sent (or attempted) the
    // 24h-before reminder for this appointment, so restarts/re-runs of the job
    // never double-send. Independent of the mobile app's local-notification
    // scheduling, which tracks its own state in on-device storage.
    reminderSentAt: timestamp("reminder_sent_at"),
    confirmationTokenHash: text("confirmation_token_hash"),
    confirmationSentAt: timestamp("confirmation_sent_at"),
    confirmedAt: timestamp("confirmed_at"),
    // Payment tracking (manually recorded by the secretaria/staff — no real
    // payment gateway integration). `isPaid` drives the "Pago"/"Não pago"
    // badge in the agenda and the paid/pending split in Gestão Financeira;
    // the other fields are only meaningful once payment has been recorded
    // at least once. Particular vs convênio revenue splits are derived from
    // the patient's `paymentType`, not stored again here.
    isPaid: boolean("is_paid").notNull().default(false),
    paymentMethod: appointmentPaymentMethodEnum("payment_method"),
    paidBy: text("paid_by"),
    paymentNotes: text("payment_notes"),
    paymentProofUrl: text("payment_proof_url"),
    paymentRecordedAt: timestamp("payment_recorded_at"),
    paymentRecordedByUserId: integer("payment_recorded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    // Amount charged for this appointment (Gestão Financeira). Defaults to the
    // doctor's registered consultationPrice/insurance price at booking time,
    // but can be edited manually by the clinic owner/secretaria.
    amountCharged: numeric("amount_charged", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // Prevents double-booking the exact same doctor/date/startTime slot at the DB level,
    // as a last line of defense on top of the application-level free-slot check.
    unique("appointments_doctor_date_start_unique").on(t.doctorId, t.date, t.startTime),
  ]
);

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;

// A patient's rating + optional comment for a completed appointment. One review
// per appointment (enforced by the unique constraint on appointmentId).
export const appointmentReviewsTable = pgTable("appointment_reviews", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id")
    .notNull()
    .unique()
    .references(() => appointmentsTable.id, { onDelete: "cascade" }),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAppointmentReviewSchema = createInsertSchema(appointmentReviewsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAppointmentReview = z.infer<typeof insertAppointmentReviewSchema>;
export type AppointmentReview = typeof appointmentReviewsTable.$inferSelect;
