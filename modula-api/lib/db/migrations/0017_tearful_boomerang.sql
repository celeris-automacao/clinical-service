ALTER TABLE "patients" ADD COLUMN "push_token" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp;