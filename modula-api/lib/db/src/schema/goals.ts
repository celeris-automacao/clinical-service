import { pgTable, serial, integer, text, numeric, date, timestamp, pgEnum, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { doctorsTable } from "./doctors";
import { clinicsTable } from "./clinics";

export const goalStatusEnum = pgEnum("goal_status", ["active", "completed", "archived"]);

// Generic, free-text goal that any health professional linked to a patient
// (doctor, psychologist, nutritionist, etc.) can define. Replaces the old
// fixed goal fields on `patients` (targetWeight, dailyWaterGoalMl,
// dailyExerciseCalorieGoal). Visible to every professional on the patient's
// care team, editable/deletable only by its creator or the clinic owner.
export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  createdByDoctorId: integer("created_by_doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "cascade" }),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  targetValue: numeric("target_value", { precision: 10, scale: 2 }),
  unit: text("unit"),
  dueDate: date("due_date"),
  status: goalStatusEnum("status").notNull().default("active"),
  // Stamped only when a staff member creates or meaningfully updates a goal
  // (title/targetValue/dueDate/status). Used by the patient unread-badge
  // endpoint instead of updatedAt to avoid noise from minor edits.
  lastStaffChangedAt: timestamp("last_staff_changed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;

// One progress record per goal per day, logged by the patient — either a
// simple "done today" toggle (for goals without a numeric unit) or a
// day's value (for goals with a targetValue/unit, e.g. "60 kg").
export const goalProgressTable = pgTable(
  "goal_progress",
  {
    id: serial("id").primaryKey(),
    goalId: integer("goal_id").notNull().references(() => goalsTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    value: numeric("value", { precision: 10, scale: 2 }),
    done: boolean("done").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("goal_progress_goal_date_idx").on(table.goalId, table.date)]
);

export const insertGoalProgressSchema = createInsertSchema(goalProgressTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGoalProgress = z.infer<typeof insertGoalProgressSchema>;
export type GoalProgress = typeof goalProgressTable.$inferSelect;
