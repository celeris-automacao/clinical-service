import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const aiPatientSummariesTable = pgTable("ai_patient_summaries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id, { onDelete: "cascade" }),
  generatedBy: integer("generated_by")
    .notNull()
    .references(() => usersTable.id),
  startDate: date("start_date"),
  endDate: date("end_date"),
  summaryText: text("summary_text").notNull(),
  doctorNotes: text("doctor_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AiPatientSummary = typeof aiPatientSummariesTable.$inferSelect;
