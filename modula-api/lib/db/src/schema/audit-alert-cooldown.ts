import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";

export const auditAlertCooldownTable = pgTable("audit_alert_cooldown", {
  clinicId: integer("clinic_id")
    .primaryKey()
    .references(() => clinicsTable.id, { onDelete: "cascade" }),
  lastSentAt: timestamp("last_sent_at").notNull(),
});

export type AuditAlertCooldown = typeof auditAlertCooldownTable.$inferSelect;
