CREATE TABLE "professional_lunch_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"doctor_id" integer NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
	"day_of_week" "weekday" NOT NULL,
	"start_time" text DEFAULT '12:00' NOT NULL,
	"end_time" text DEFAULT '13:00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "professional_lunch_breaks_doctor_day_unique" UNIQUE("doctor_id", "day_of_week")
);
--> statement-breakpoint
INSERT INTO "professional_lunch_breaks" ("doctor_id", "day_of_week")
SELECT DISTINCT "doctor_id", "day_of_week"
FROM "professional_availability"
ON CONFLICT ("doctor_id", "day_of_week") DO NOTHING;
