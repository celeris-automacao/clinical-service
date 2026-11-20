import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const sabotageNotesTable = pgTable("sabotage_notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  reason: text("reason").notNull(),
  whatHappened: text("what_happened"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSabotageNoteSchema = createInsertSchema(sabotageNotesTable).omit({ id: true, createdAt: true });
export type InsertSabotageNote = z.infer<typeof insertSabotageNoteSchema>;
export type SabotageNote = typeof sabotageNotesTable.$inferSelect;
