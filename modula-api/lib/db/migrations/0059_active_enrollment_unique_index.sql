CREATE UNIQUE INDEX "patient_packages_unique_active_patient_program_clinic"
ON "patient_packages" ("patient_id", "package_id", "clinic_id")
WHERE "status" = 'active';
