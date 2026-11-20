import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { patientsTable } from "./patients";

export const mealLabelEnum = pgEnum("meal_label", [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
]);

export const calorieEntriesTable = pgTable("calorie_entries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  mealLabel: mealLabelEnum("meal_label").default("other"),
  photoUrl: text("photo_url"),
  calories: integer("calories").notNull(),
  aiDescription: text("ai_description"),
  proteinG: integer("protein_g"),
  carbG: integer("carb_g"),
  fatG: integer("fat_g"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCalorieEntrySchema = createInsertSchema(calorieEntriesTable).omit({
  id: true,
  createdAt: true,
});
