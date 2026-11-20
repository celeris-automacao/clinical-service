import { pgEnum, pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";

export const commercialLeadTypeEnum = pgEnum("commercial_lead_type", [
  "new_prospect",
  "enterprise_upgrade",
]);

export const commercialLeadStatusEnum = pgEnum("commercial_lead_status", [
  "novo",
  "contatado",
  "convertido",
  "perdido",
]);

export const commercialLeadsTable = pgTable("commercial_leads", {
  id: serial("id").primaryKey(),
  type: commercialLeadTypeEnum("type").notNull(),
  clinicId: integer("clinic_id").references(() => clinicsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  status: commercialLeadStatusEnum("status").notNull().default("novo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
