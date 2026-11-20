import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { paymentTypeEnum } from "./patients";

export const leadStatusEnum = pgEnum("lead_status", [
  "novo",
  "contatado",
  "agendado",
  "convertido",
  "perdido",
]);

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contact: text("contact"),
  source: text("source"),
  status: leadStatusEnum("status").notNull().default("novo"),
  notes: text("notes"),
  paymentType: paymentTypeEnum("payment_type").notNull().default("particular"),
  insuranceName: text("insurance_name"),
  convertedPatientId: integer("converted_patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  authorUserId: integer("author_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
