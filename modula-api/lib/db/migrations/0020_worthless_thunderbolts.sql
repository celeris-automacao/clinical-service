ALTER TABLE "patients" ADD COLUMN "has_allergies" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "has_dietary_restrictions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "psychology_notes" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "physical_activity_notes" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "endocrinology_notes" text;