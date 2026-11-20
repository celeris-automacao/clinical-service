import { pgTable, serial, integer, text, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { clinicsTable } from "./clinics";

export const contractStatusEnum = pgEnum("contract_status", [
  "pending_signature",
  "signed",
  "deleted",
]);

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id")
    .notNull()
    .references(() => clinicsTable.id, { onDelete: "cascade" }),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  termsContent: text("terms_content").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalValueCents: integer("total_value_cents").notNull().default(0),
  status: contractStatusEnum("status").notNull().default("pending_signature"),
  signatureImageUrl: text("signature_image_url"),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  signatureImageUrl: true,
  signedAt: true,
});
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
