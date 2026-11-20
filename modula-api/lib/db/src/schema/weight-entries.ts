import { pgTable, serial, integer, numeric, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const weightEntriesTable = pgTable("weight_entries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }).notNull(),
  note: text("note"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWeightEntrySchema = createInsertSchema(weightEntriesTable).omit({ id: true, createdAt: true });
export type InsertWeightEntry = z.infer<typeof insertWeightEntrySchema>;
export type WeightEntry = typeof weightEntriesTable.$inferSelect;
