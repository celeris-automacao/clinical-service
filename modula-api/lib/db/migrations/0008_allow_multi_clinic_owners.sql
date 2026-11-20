-- Allow a single clinic_owner user to own multiple clinics
-- by removing the unique constraint on user_id in clinic_owners
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='clinic_owners_user_id_unique'
  ) THEN
    ALTER TABLE "clinic_owners" DROP CONSTRAINT "clinic_owners_user_id_unique";
  END IF;
END$$;
