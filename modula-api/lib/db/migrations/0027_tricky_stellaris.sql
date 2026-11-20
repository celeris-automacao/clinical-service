CREATE TABLE "doctor_insurances" (
	"id" serial PRIMARY KEY NOT NULL,
	"doctor_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "consultation_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "accepts_insurance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_insurances" ADD CONSTRAINT "doctor_insurances_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;