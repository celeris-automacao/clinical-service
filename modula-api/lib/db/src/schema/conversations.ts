import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { clinicsTable } from "./clinics";

/**
 * Conversations are generic 1:1 threads between two `users` rows in the same
 * clinic. `participantAUserId` is always the lower of the two user ids and
 * `participantBUserId` the higher — this keeps the pair order-independent so
 * the unique constraint can't be bypassed by swapping the two sides.
 */
export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    participantAUserId: integer("participant_a_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    participantBUserId: integer("participant_b_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("conversations_participants_clinic_unique").on(
      table.participantAUserId,
      table.participantBUserId,
      table.clinicId
    ),
  ]
);

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
