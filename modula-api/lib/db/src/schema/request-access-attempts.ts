import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const requestAccessAttemptsTable = pgTable(
  "request_access_attempts",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    ip: text("ip"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("request_access_attempts_email_attempted_at_idx").on(t.email, t.attemptedAt),
    index("request_access_attempts_ip_attempted_at_idx").on(t.ip, t.attemptedAt),
  ]
);

export type RequestAccessAttempt = typeof requestAccessAttemptsTable.$inferSelect;
