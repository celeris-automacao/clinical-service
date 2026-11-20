import { pgTable, serial, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const waterEntriesTable = pgTable("water_entries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  amountMl: integer("amount_ml").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWaterEntrySchema = createInsertSchema(waterEntriesTable).omit({ id: true, createdAt: true });
export type InsertWaterEntry = z.infer<typeof insertWaterEntrySchema>;
export type WaterEntry = typeof waterEntriesTable.$inferSelect;
