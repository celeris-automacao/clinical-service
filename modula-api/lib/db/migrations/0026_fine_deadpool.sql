CREATE TYPE "public"."payment_type" AS ENUM('particular', 'convenio');--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "payment_type" "payment_type" DEFAULT 'particular' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "insurance_name" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "payment_type" "payment_type" DEFAULT 'particular' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "insurance_name" text;