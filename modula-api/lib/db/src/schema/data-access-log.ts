import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";

export const dataAccessLogTable = pgTable("data_access_log", {
  id: serial("id").primaryKey(),
  accessorUserId: integer("accessor_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accessorRole: text("accessor_role").notNull(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  clinicId: integer("clinic_id").references(() => clinicsTable.id, { onDelete: "set null" }),
  fieldsAccessed: text("fields_accessed").array().notNull().default([]),
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
});

export type DataAccessLog = typeof dataAccessLogTable.$inferSelect;
