import { pgTable, serial, integer, text, numeric, date, timestamp, smallint, boolean, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const weightGoalStatusEnum = pgEnum("weight_goal_status", [
  "none",
  "pending",
  "validated",
  "rejected",
]);

export const paymentTypeEnum = pgEnum("payment_type", ["particular", "convenio"]);

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clinicId: integer("clinic_id"),
  startWeight: numeric("start_weight", { precision: 5, scale: 2 }).notNull(),
  targetWeight: numeric("target_weight", { precision: 5, scale: 2 }),
  proposedTargetWeight: numeric("proposed_target_weight", { precision: 5, scale: 2 }),
  weightGoalStatus: weightGoalStatusEnum("weight_goal_status").notNull().default("none"),
  weightGoalValidatedByUserId: integer("weight_goal_validated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  weightGoalValidatedAt: timestamp("weight_goal_validated_at"),
  dateOfBirth: date("date_of_birth"),
  phone: text("phone"),
  paymentType: paymentTypeEnum("payment_type").notNull().default("particular"),
  insuranceName: text("insurance_name"),
  dailyCalorieGoal: integer("daily_calorie_goal"),
  dailyWaterGoalMl: integer("daily_water_goal_ml").notNull().default(2000),
  dailyExerciseCalorieGoal: integer("daily_exercise_calorie_goal").notNull().default(300),
  proteinGoalG: integer("protein_goal_g"),
  carbGoalG: integer("carb_goal_g"),
  fatGoalG: integer("fat_goal_g"),
  mealsPerDay: integer("meals_per_day"),
  dietaryRestrictions: text("dietary_restrictions"),
  nutritionNotes: text("nutrition_notes"),
  allergies: text("allergies"),
  hasAllergies: boolean("has_allergies").notNull().default(false),
  hasDietaryRestrictions: boolean("has_dietary_restrictions").notNull().default(false),
  psychologyNotes: text("psychology_notes"),
  physicalActivityNotes: text("physical_activity_notes"),
  endocrinologyNotes: text("endocrinology_notes"),
  medicalConditions: text("medical_conditions"),
  cpf: text("cpf"),
  rg: text("rg"),
  addressStreet: text("address_street"),
  addressNumber: text("address_number"),
  addressComplement: text("address_complement"),
  addressNeighborhood: text("address_neighborhood"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  lastBirthdayNotificationYear: smallint("last_birthday_notification_year"),
  pushToken: text("push_token"),
  lastSeenGoalsAt: timestamp("last_seen_goals_at"),
  waterReminderEnabled: boolean("water_reminder_enabled"),
  waterReminderHour: smallint("water_reminder_hour"),
  waterReminderMinute: smallint("water_reminder_minute"),
  waterReminderFrequency: smallint("water_reminder_frequency"),
  weightReminderEnabled: boolean("weight_reminder_enabled"),
  weightReminderHour: smallint("weight_reminder_hour"),
  weightReminderMinute: smallint("weight_reminder_minute"),
  weightReminderFrequency: smallint("weight_reminder_frequency"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(t) => [
  uniqueIndex("patients_clinic_cpf_unique")
    .on(t.clinicId, t.cpf)
    .where(sql`${t.cpf} IS NOT NULL AND ${t.clinicId} IS NOT NULL`),
]);

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
