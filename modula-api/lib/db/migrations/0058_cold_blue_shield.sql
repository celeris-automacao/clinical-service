CREATE TYPE "public"."patient_package_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "care_package_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"specialty" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_days" integer NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_package_doctors" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_package_id" integer NOT NULL,
	"slot_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"package_id" integer NOT NULL,
	"clinic_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "patient_package_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_failures" ALTER COLUMN "owner_notified_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "care_package_slots" ADD CONSTRAINT "care_package_slots_package_id_care_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."care_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_packages" ADD CONSTRAINT "care_packages_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_package_doctors" ADD CONSTRAINT "patient_package_doctors_patient_package_id_patient_packages_id_fk" FOREIGN KEY ("patient_package_id") REFERENCES "public"."patient_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_package_doctors" ADD CONSTRAINT "patient_package_doctors_slot_id_care_package_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."care_package_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_package_doctors" ADD CONSTRAINT "patient_package_doctors_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_package_id_care_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."care_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;