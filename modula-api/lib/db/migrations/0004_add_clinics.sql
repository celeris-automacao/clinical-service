CREATE TABLE IF NOT EXISTS "clinics" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "logo_url" text,
  "primary_color" text DEFAULT '#16a34a',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "patient_clinics" (
  "patient_id" integer NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
  "clinic_id" integer NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "enrolled_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY("patient_id", "clinic_id")
);
