CREATE TABLE "clinic_public_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"slug" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"about" text,
	"cover_image_url" text,
	"address" text,
	"phone" text,
	"contact_email" text,
	"social_links" jsonb,
	"business_hours" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clinic_public_pages_clinic_id_unique" UNIQUE("clinic_id"),
	CONSTRAINT "clinic_public_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "clinic_public_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "show_on_public_page" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clinic_public_pages" ADD CONSTRAINT "clinic_public_pages_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_public_services" ADD CONSTRAINT "clinic_public_services_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;