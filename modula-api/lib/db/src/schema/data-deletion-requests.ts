import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const dataDeletionRequestsTable = pgTable("data_deletion_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  cancelledAt: timestamp("cancelled_at"),
  approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  notes: text("notes"),
});

export type DataDeletionRequest = typeof dataDeletionRequestsTable.$inferSelect;
