import { pgTable, serial, integer, text, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { clinicsTable } from "./clinics";

export const doctorsTable = pgTable("doctors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "restrict" }),
  specialty: text("specialty").notNull().default("general"),
  bio: text("bio"),
  consultationPrice: numeric("consultation_price", { precision: 10, scale: 2 }),
  acceptsInsurance: boolean("accepts_insurance").notNull().default(false),
  showOnPublicPage: boolean("show_on_public_page").notNull().default(false),
  // Percentage (0-100) of revenue this professional receives as commission,
  // configurable by the clinic owner. Null means no commission configured yet.
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }),
  phone: text("phone"),
  cpf: text("cpf"),
  rg: text("rg"),
  birthDate: text("birth_date"),
  salary: numeric("salary", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctorsTable.$inferSelect;

export const doctorInsurancesTable = pgTable("doctor_insurances", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDoctorInsuranceSchema = createInsertSchema(doctorInsurancesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDoctorInsurance = z.infer<typeof insertDoctorInsuranceSchema>;
export type DoctorInsurance = typeof doctorInsurancesTable.$inferSelect;

export const patientDoctorsTable = pgTable("patient_doctors", {
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const secretariesTable = pgTable("secretaries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "restrict" }),
  phone: text("phone"),
  cpf: text("cpf"),
  rg: text("rg"),
  birthDate: text("birth_date"),
  salary: numeric("salary", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSecretarySchema = createInsertSchema(secretariesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSecretary = z.infer<typeof insertSecretarySchema>;
export type Secretary = typeof secretariesTable.$inferSelect;
