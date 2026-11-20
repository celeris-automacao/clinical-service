import { pgTable, serial, integer, text, timestamp, unique, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { clinicsTable } from "./clinics";

/**
 * Community posts are a per-clinic social feed. Any authenticated clinic
 * member (patient, secretaria, clinic_owner, profissional_saude) can post
 * text plus one optional file, photo, or video in the clinic feed.
 */
export const communityMediaTypeEnum = pgEnum("community_media_type", ["photo", "video", "file"]);

/**
 * Per-user, per-clinic mute preference for the community realtime feed.
 * Presence of a row means the user has silenced SSE updates for that
 * clinic's community feed. The feed itself remains accessible via polling.
 */
export const communityNotificationMutesTable = pgTable(
  "community_notification_mutes",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
  },
  (table) => [unique("community_notification_mutes_user_clinic_unique").on(table.userId, table.clinicId)]
);

export const communityPostsTable = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id")
    .notNull()
    .references(() => clinicsTable.id, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content"),
  mediaUrl: text("media_url"),
  mediaType: communityMediaTypeEnum("media_type"),
  mediaName: text("media_name"),
  mediaContentType: text("media_content_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const communityPostLikesTable = pgTable(
  "community_post_likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => communityPostsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("community_post_likes_post_user_unique").on(table.postId, table.userId)]
);

export const communityCommentsTable = pgTable("community_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => communityPostsTable.id, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: communityMediaTypeEnum("media_type"),
  mediaName: text("media_name"),
  mediaContentType: text("media_content_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const communityReportTargetTypeEnum = pgEnum("community_report_target_type", ["post", "comment"]);
export const communityReportStatusEnum = pgEnum("community_report_status", ["open", "dismissed"]);

export const communityReportsTable = pgTable("community_reports", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id")
    .notNull()
    .references(() => clinicsTable.id, { onDelete: "cascade" }),
  reporterUserId: integer("reporter_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  targetType: communityReportTargetTypeEnum("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  reason: text("reason"),
  status: communityReportStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCommunityPostSchema = createInsertSchema(communityPostsTable).omit({
  id: true,
  createdAt: true,
});
export const insertCommunityCommentSchema = createInsertSchema(communityCommentsTable).omit({
  id: true,
  createdAt: true,
});
export const insertCommunityReportSchema = createInsertSchema(communityReportsTable).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type CommunityPost = typeof communityPostsTable.$inferSelect;
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPostLike = typeof communityPostLikesTable.$inferSelect;
export type CommunityComment = typeof communityCommentsTable.$inferSelect;
export type InsertCommunityComment = z.infer<typeof insertCommunityCommentSchema>;
export type CommunityReport = typeof communityReportsTable.$inferSelect;
export type InsertCommunityReport = z.infer<typeof insertCommunityReportSchema>;
