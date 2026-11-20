DO $$ BEGIN
  CREATE TYPE "public"."community_report_status" AS ENUM('open', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."community_report_target_type" AS ENUM('post', 'comment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_reports" (
"id" serial PRIMARY KEY NOT NULL,
"clinic_id" integer NOT NULL,
"reporter_user_id" integer NOT NULL,
"target_type" "community_report_target_type" NOT NULL,
"target_id" integer NOT NULL,
"reason" text,
"status" "community_report_status" DEFAULT 'open' NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
