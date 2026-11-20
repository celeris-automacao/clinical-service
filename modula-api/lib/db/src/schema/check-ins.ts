import { pgTable, serial, integer, boolean, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const checkInsTable = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  didExercise: boolean("did_exercise").default(false),
  drankWater: boolean("drank_water").default(false),
  ateWell: boolean("ate_well").default(false),
  note: text("note"),
  photoUrl: text("photo_url"),
  foodPhotoUrl: text("food_photo_url"),
  exercisePhotoUrl: text("exercise_photo_url"),
  foodCalorieEstimate: integer("food_calorie_estimate"),
  exerciseDescription: text("exercise_description"),
  exerciseCalorieEstimate: integer("exercise_calorie_estimate"),
  xpEarned: integer("xp_earned").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCheckInSchema = createInsertSchema(checkInsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkInsTable.$inferSelect;
