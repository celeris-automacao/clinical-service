import { pgTable, serial, integer, text, boolean, timestamp, jsonb, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";
import { patientsTable } from "./patients";

export const questionTypeEnum = pgEnum("question_type", ["yes_no", "text", "multiple_choice"]);

// A questionnaire form created by a clinic (clinic_owner or profissional_saude).
export const formsTable = pgTable("forms", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  createdByUserId: integer("created_by_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFormSchema = createInsertSchema(formsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof formsTable.$inferSelect;

// Individual question inside a form.
export const formQuestionsTable = pgTable("form_questions", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => formsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  questionType: questionTypeEnum("question_type").notNull(),
  // Only used for multiple_choice: array of option strings stored as JSONB.
  options: jsonb("options").$type<string[]>(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFormQuestionSchema = createInsertSchema(formQuestionsTable).omit({ id: true, createdAt: true });
export type InsertFormQuestion = z.infer<typeof insertFormQuestionSchema>;
export type FormQuestion = typeof formQuestionsTable.$inferSelect;

// Assigns a form to a patient (patientId) or to all patients in a clinic (patientId = null).
export const formAssignmentsTable = pgTable(
  "form_assignments",
  {
    id: serial("id").primaryKey(),
    formId: integer("form_id").notNull().references(() => formsTable.id, { onDelete: "cascade" }),
    // null = assigned to all patients in the clinic
    patientId: integer("patient_id").references(() => patientsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("form_assignments_form_patient_idx").on(t.formId, t.patientId),
  ]
);

export const insertFormAssignmentSchema = createInsertSchema(formAssignmentsTable).omit({ id: true, createdAt: true });
export type InsertFormAssignment = z.infer<typeof insertFormAssignmentSchema>;
export type FormAssignment = typeof formAssignmentsTable.$inferSelect;

// A patient's submitted response to a form (one response per patient per form).
export const formResponsesTable = pgTable("form_responses", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => formsTable.id, { onDelete: "cascade" }),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertFormResponseSchema = createInsertSchema(formResponsesTable).omit({ id: true, submittedAt: true });
export type InsertFormResponse = z.infer<typeof insertFormResponseSchema>;
export type FormResponse = typeof formResponsesTable.$inferSelect;

// Individual answer for one question within a form_response.
export const formResponseAnswersTable = pgTable("form_response_answers", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => formResponsesTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => formQuestionsTable.id, { onDelete: "cascade" }),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFormResponseAnswerSchema = createInsertSchema(formResponseAnswersTable).omit({ id: true, createdAt: true });
export type InsertFormResponseAnswer = z.infer<typeof insertFormResponseAnswerSchema>;
export type FormResponseAnswer = typeof formResponseAnswersTable.$inferSelect;
