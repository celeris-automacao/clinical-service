ALTER TABLE "community_comments" ADD COLUMN "media_url" text;
--> statement-breakpoint
ALTER TABLE "community_comments" ADD COLUMN "media_type" "community_media_type";
--> statement-breakpoint
ALTER TABLE "community_comments" ADD COLUMN "media_name" text;
--> statement-breakpoint
ALTER TABLE "community_comments" ADD COLUMN "media_content_type" text;
