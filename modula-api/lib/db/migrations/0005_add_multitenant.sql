-- Add clinic_id to doctors table (NOT NULL — every doctor must belong to exactly one clinic)
-- Step 1: add nullable temporarily
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "clinic_id" integer REFERENCES "clinics"("id") ON DELETE RESTRICT;

-- Step 2: backfill any existing doctors that lack a clinic_id.
--         Assigns them to the first clinic by ID (safest deterministic choice for existing data).
DO $$
DECLARE
  first_clinic_id integer;
BEGIN
  SELECT id INTO first_clinic_id FROM "clinics" ORDER BY id LIMIT 1;
  IF first_clinic_id IS NOT NULL THEN
    UPDATE "doctors" SET "clinic_id" = first_clinic_id WHERE "clinic_id" IS NULL;
  END IF;
END$$;

-- Step 3: enforce NOT NULL after backfill (no null rows remain, or table is empty)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='doctors' AND column_name='clinic_id' AND is_nullable='YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM "doctors" WHERE "clinic_id" IS NULL
  ) THEN
    ALTER TABLE "doctors" ALTER COLUMN "clinic_id" SET NOT NULL;
  END IF;
END$$;

-- Add clinic_owners junction table (UNIQUE on user_id: each owner belongs to exactly one clinic)
CREATE TABLE IF NOT EXISTS "clinic_owners" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "clinic_id" integer NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY("user_id", "clinic_id")
);

-- Enforce one clinic per owner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='clinic_owners_user_id_unique'
  ) THEN
    ALTER TABLE "clinic_owners" ADD CONSTRAINT "clinic_owners_user_id_unique" UNIQUE ("user_id");
  END IF;
END$$;

-- Add clinic_id to clinic_settings table (per-clinic, unique)
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "clinic_id" integer REFERENCES "clinics"("id") ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='clinic_settings_clinic_id_unique'
  ) THEN
    ALTER TABLE "clinic_settings" ADD CONSTRAINT "clinic_settings_clinic_id_unique" UNIQUE ("clinic_id");
  END IF;
END$$;
