import { pgTable, serial, text, timestamp, integer, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { clinicsTable } from "./clinics";

export const clinicPlanEnum = pgEnum("clinic_plan", [
  "basic",
  "pro",
  "professional",
  "enterprise",
]);

export const clinicSettingsTable = pgTable("clinic_settings", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinicsTable.id, { onDelete: "cascade" }),
  plan: clinicPlanEnum("plan").notNull().default("basic"),
  clinicName: text("clinic_name"),
  logoUrl: text("logo_url"),
  senderName: text("sender_name"),
  fromEmail: text("from_email"),
  replyToEmail: text("reply_to_email"),
  lastPlanLimitAlert: text("last_plan_limit_alert"),
  privacyPolicyUrl: text("privacy_policy_url"),
  termsUrl: text("terms_url"),
  copyrightUrl: text("copyright_url"),
  contactUrl: text("contact_url"),
  deletionRequestUrl: text("deletion_request_url"),
  brandingVersion: integer("branding_version").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [unique("clinic_settings_clinic_id_unique").on(t.clinicId)]);

export const insertClinicSettingsSchema = createInsertSchema(clinicSettingsTable);

export const PLAN_DOCTOR_LIMITS: Record<string, number> = {
  basic: 2,
  pro: 5,
  professional: 10,
  enterprise: Infinity,
};

export const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  pro: "Pro",
  professional: "Professional",
  enterprise: "Enterprise",
};

export const PLAN_PRICES: Record<string, string> = {
  basic: "R$ 149,00 / mês",
  pro: "R$ 299,00 / mês",
  professional: "R$ 499,00 / mês",
  enterprise: "A partir de R$ 799,00 / mês",
};
