ALTER TABLE "care_package_slots"
  ADD COLUMN "doctor_id" integer REFERENCES "doctors"("id") ON DELETE SET NULL;
