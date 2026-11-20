CREATE TYPE "public"."appointment_modality" AS ENUM('presencial', 'teleconsulta');--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "modality" "appointment_modality" DEFAULT 'presencial' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "meeting_link" text;