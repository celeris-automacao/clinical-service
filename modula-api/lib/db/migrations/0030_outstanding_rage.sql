CREATE TYPE "public"."appointment_payment_method" AS ENUM('dinheiro', 'cartao', 'pix', 'convenio', 'outro');--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_method" "appointment_payment_method";--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "paid_by" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_notes" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_proof_url" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_recorded_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_recorded_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_payment_recorded_by_user_id_users_id_fk" FOREIGN KEY ("payment_recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;