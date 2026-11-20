import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const exerciseEntriesTable = pgTable("exercise_entries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  description: text("description").notNull(),
  durationMin: integer("duration_min"),
  calorieEstimate: integer("calorie_estimate"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExerciseEntrySchema = createInsertSchema(exerciseEntriesTable).omit({ id: true, createdAt: true });
export type InsertExerciseEntry = z.infer<typeof insertExerciseEntrySchema>;
export type ExerciseEntry = typeof exerciseEntriesTable.$inferSelect;
