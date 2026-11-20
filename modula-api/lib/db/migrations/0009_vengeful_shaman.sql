CREATE TABLE "water_entries" (
        "id" serial PRIMARY KEY NOT NULL,
        "patient_id" integer NOT NULL,
        "date" date NOT NULL,
        "amount_ml" integer NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_entries" (
        "id" serial PRIMARY KEY NOT NULL,
        "patient_id" integer NOT NULL,
        "date" date NOT NULL,
        "description" text NOT NULL,
        "duration_min" integer,
        "calorie_estimate" integer,
        "photo_url" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
