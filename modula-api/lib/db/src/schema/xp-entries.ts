import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const xpReasonEnum = pgEnum("xp_reason", [
  "exercise",
  "water",
  "nutrition",
  "weekly_bonus",
  "monthly_bonus",
]);

export const xpEntriesTable = pgTable("xp_entries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: xpReasonEnum("reason").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertXpEntrySchema = createInsertSchema(xpEntriesTable).omit({ id: true, createdAt: true });
export type InsertXpEntry = z.infer<typeof insertXpEntrySchema>;
export type XpEntry = typeof xpEntriesTable.$inferSelect;
