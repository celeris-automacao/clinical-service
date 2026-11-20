import { pgTable, serial, integer, text, pgEnum, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "salario",
  "agua",
  "luz",
  "telefone",
  "internet",
  "outro",
]);

// A manually-logged operational expense for a clinic (Gestão Financeira).
// `period` is stored as "YYYY-MM" to group expenses by month, independent of
// the exact day the expense was logged. `receiptUrl` is an optional object
// storage path (image or PDF) attached as proof of the expense.
export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  category: expenseCategoryEnum("category").notNull().default("outro"),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  period: text("period").notNull(),
  receiptUrl: text("receipt_url"),
  // Kept NOT NULL for audit purposes; "restrict" prevents deleting a user who
  // has logged expenses (would otherwise silently orphan financial records).
  createdByUserId: integer("created_by_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
