import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { usersTable, roleEnum } from "./users";

export const patientNotesTable = pgTable("patient_notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  authorRole: roleEnum("author_role").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPatientNoteSchema = createInsertSchema(patientNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPatientNote = z.infer<typeof insertPatientNoteSchema>;
export type PatientNote = typeof patientNotesTable.$inferSelect;
