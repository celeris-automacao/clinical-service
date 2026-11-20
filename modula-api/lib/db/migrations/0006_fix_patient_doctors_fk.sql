-- Fix patient_doctors.patient_id FK: ensure it references patients(id), not users(id).
-- This corrects a schema inconsistency that could arise when the table was created
-- via drizzle-kit push before the FK target was updated to patients.
DO $$
DECLARE
  wrong_cname text;
BEGIN
  -- Find any FK on patient_doctors.patient_id that incorrectly references users
  SELECT tc.constraint_name INTO wrong_cname
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
  JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
  JOIN information_schema.table_constraints tc2
    ON rc.unique_constraint_name = tc2.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'patient_doctors'
    AND kcu.column_name = 'patient_id'
    AND tc2.table_name = 'users';

  IF wrong_cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE patient_doctors DROP CONSTRAINT ' || quote_ident(wrong_cname);
    RAISE NOTICE 'Dropped incorrect FK: %', wrong_cname;
  END IF;

  -- Add the correct FK if it is not already present
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.table_constraints tc2
      ON rc.unique_constraint_name = tc2.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'patient_doctors'
      AND kcu.column_name = 'patient_id'
      AND tc2.table_name = 'patients'
  ) THEN
    ALTER TABLE patient_doctors
      ADD CONSTRAINT patient_doctors_patient_id_patients_id_fk
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE ON UPDATE NO ACTION;
    RAISE NOTICE 'Added correct FK: patient_doctors.patient_id -> patients(id)';
  END IF;
END$$;
