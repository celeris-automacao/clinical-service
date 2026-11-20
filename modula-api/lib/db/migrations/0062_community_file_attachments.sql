ALTER TYPE "community_media_type" ADD VALUE 'file';
--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "media_name" text;
--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "media_content_type" text;
