import { pgTable, serial, text, timestamp, boolean, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("user_role", [
  "patient",
  "profissional_saude",
  "clinic_owner",
  "super_admin",
  "secretaria",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("patient"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  isTemporaryPassword: boolean("is_temporary_password").default(false),
  accessToken: text("access_token").unique(),
  appleUserId: text("apple_user_id").unique(),
  deactivatedAt: timestamp("deactivated_at"),
  cpf: text("cpf").unique(),
  rg: text("rg"),
  phone: text("phone"),
  birthDate: text("birth_date"),
  temporaryPasswordExpiresAt: timestamp("temporary_password_expires_at"),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lastFailedLoginAt: timestamp("last_failed_login_at"),
  deletionRequestedAt: timestamp("deletion_requested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
