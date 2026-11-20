import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, boolean, timestamp, date, pgEnum, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { doctorsTable } from "./doctors";
import { usersTable } from "./users";

export const patientPackageStatusEnum = pgEnum("patient_package_status", [
  "active",
  "completed",
  "cancelled",
]);

export const carePackagePromotionUploadsTable = pgTable("care_package_promotion_uploads", {
  objectPath: text("object_path").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  uploadedByUserId: integer("uploaded_by_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A reusable program/package that a clinic offers (e.g. "EmagreSer — 2 months").
export const carePackagesTable = pgTable("care_packages", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  durationDays: integer("duration_days").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  originalPriceCents: integer("original_price_cents"),
  promotionImages: text("promotion_images").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCarePackageSchema = createInsertSchema(carePackagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCarePackage = z.infer<typeof insertCarePackageSchema>;
export type CarePackage = typeof carePackagesTable.$inferSelect;

// Each "slot" in a care package defines a specialty and how many professionals of that specialty are required.
export const carePackageSlotsTable = pgTable("care_package_slots", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => carePackagesTable.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id").references(() => doctorsTable.id, { onDelete: "set null" }),
  specialty: text("specialty").notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCarePackageSlotSchema = createInsertSchema(carePackageSlotsTable).omit({ id: true, createdAt: true });
export type InsertCarePackageSlot = z.infer<typeof insertCarePackageSlotSchema>;
export type CarePackageSlot = typeof carePackageSlotsTable.$inferSelect;

// A patient enrolled in a care package.
export const patientPackagesTable = pgTable("patient_packages", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  packageId: integer("package_id").notNull().references(() => carePackagesTable.id, { onDelete: "restrict" }),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "restrict" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: patientPackageStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueActiveEnrollment: uniqueIndex("patient_packages_unique_active_patient_program_clinic")
    .on(table.patientId, table.packageId, table.clinicId)
    .where(sql`${table.status} = 'active'`),
}));

export const insertPatientPackageSchema = createInsertSchema(patientPackagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatientPackage = z.infer<typeof insertPatientPackageSchema>;
export type PatientPackage = typeof patientPackagesTable.$inferSelect;

// Which doctor fills each slot in a patient's enrollment. Tracks which patient_doctors links were created by this enrollment.
export const patientPackageDoctorsTable = pgTable("patient_package_doctors", {
  id: serial("id").primaryKey(),
  patientPackageId: integer("patient_package_id").notNull().references(() => patientPackagesTable.id, { onDelete: "cascade" }),
  slotId: integer("slot_id").notNull().references(() => carePackageSlotsTable.id, { onDelete: "restrict" }),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPatientPackageDoctorSchema = createInsertSchema(patientPackageDoctorsTable).omit({ id: true, createdAt: true });
export type InsertPatientPackageDoctor = z.infer<typeof insertPatientPackageDoctorSchema>;
export type PatientPackageDoctor = typeof patientPackageDoctorsTable.$inferSelect;
