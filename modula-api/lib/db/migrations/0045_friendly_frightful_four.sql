CREATE TABLE IF NOT EXISTS "consent_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"clinic_id" integer,
	"purpose" text DEFAULT 'health_data_processing' NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"ip_address" text,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_deletion_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"cancelled_at" timestamp,
	"approved_by" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"accessor_user_id" integer NOT NULL,
	"accessor_role" text NOT NULL,
	"patient_id" integer NOT NULL,
	"clinic_id" integer,
	"fields_accessed" text[] DEFAULT '{}' NOT NULL,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_failed_login_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END; $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END; $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END; $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END; $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_access_log" ADD CONSTRAINT "data_access_log_accessor_user_id_users_id_fk" FOREIGN KEY ("accessor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END; $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_access_log" ADD CONSTRAINT "data_access_log_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END; $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_access_log" ADD CONSTRAINT "data_access_log_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END; $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END; $$;
