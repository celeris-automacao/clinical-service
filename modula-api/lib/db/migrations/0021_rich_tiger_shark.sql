ALTER TABLE "patients" ADD COLUMN "water_reminder_enabled" boolean;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "water_reminder_hour" smallint;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "water_reminder_minute" smallint;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "water_reminder_frequency" smallint;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "weight_reminder_enabled" boolean;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "weight_reminder_hour" smallint;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "weight_reminder_minute" smallint;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "weight_reminder_frequency" smallint;