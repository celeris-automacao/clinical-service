CREATE TYPE "commercial_lead_type" AS ENUM ('new_prospect', 'enterprise_upgrade');--> statement-breakpoint
CREATE TYPE "commercial_lead_status" AS ENUM ('novo', 'contatado', 'convertido', 'perdido');--> statement-breakpoint
CREATE TABLE "commercial_leads" (
  "id" serial PRIMARY KEY NOT NULL,
  "type" "commercial_lead_type" NOT NULL,
  "clinic_id" integer,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "message" text,
  "status" "commercial_lead_status" DEFAULT 'novo' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "commercial_leads" ADD CONSTRAINT "commercial_leads_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commercial_leads_status_created_at_idx" ON "commercial_leads" USING btree ("status", "created_at");
