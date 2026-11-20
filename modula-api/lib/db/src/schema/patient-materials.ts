import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const materialTypeEnum = pgEnum("material_type", [
  "video",
  "pdf",
  "prescription",
  "meal_plan",
  "other",
]);

export const patientMaterialsTable = pgTable("patient_materials", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: materialTypeEnum("type").notNull().default("other"),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  externalUrl: text("external_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPatientMaterialSchema = createInsertSchema(patientMaterialsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPatientMaterial = z.infer<typeof insertPatientMaterialSchema>;
export type PatientMaterial = typeof patientMaterialsTable.$inferSelect;
