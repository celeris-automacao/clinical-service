import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clinicsTable } from "./clinics";

export const consentRecordsTable = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clinicId: integer("clinic_id").references(() => clinicsTable.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull().default("health_data_processing"),
  version: text("version").notNull().default("1.0"),
  ipAddress: text("ip_address"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export type ConsentRecord = typeof consentRecordsTable.$inferSelect;
