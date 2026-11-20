CREATE TABLE "clinic_gallery_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinic_public_pages" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "clinic_gallery_photos" ADD CONSTRAINT "clinic_gallery_photos_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;