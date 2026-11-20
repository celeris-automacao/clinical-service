CREATE TABLE IF NOT EXISTS "audit_failures" (
"id" serial PRIMARY KEY NOT NULL,
"clinic_id" integer,
"accessor_user_id" integer,
"patient_id" integer,
"accessor_role" text,
"fields_accessed" text[] DEFAULT '{}' NOT NULL,
"error_message" text,
"failed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_failures" ADD CONSTRAINT "audit_failures_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_failures" ADD CONSTRAINT "audit_failures_accessor_user_id_users_id_fk" FOREIGN KEY ("accessor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_failures" ADD CONSTRAINT "audit_failures_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
