import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";

export const auditFailuresTable = pgTable("audit_failures", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinicsTable.id, { onDelete: "set null" }),
  accessorUserId: integer("accessor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  patientId: integer("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  accessorRole: text("accessor_role"),
  fieldsAccessed: text("fields_accessed").array().notNull().default([]),
  errorMessage: text("error_message"),
  failedAt: timestamp("failed_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => usersTable.id, { onDelete: "set null" }),
  ownerNotifiedAt: timestamp("owner_notified_at"),
});

export type AuditFailure = typeof auditFailuresTable.$inferSelect;
