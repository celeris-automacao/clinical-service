DO $$ BEGIN
  CREATE TYPE "public"."contract_status" AS ENUM('pending_signature', 'signed', 'deleted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"title" text NOT NULL,
	"terms_content" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_value_cents" integer DEFAULT 0 NOT NULL,
	"status" "contract_status" DEFAULT 'pending_signature' NOT NULL,
	"signature_image_url" text,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
