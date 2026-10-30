ALTER TABLE "clinical"."patients"
ADD COLUMN "normalized_document" TEXT;

CREATE OR REPLACE FUNCTION "clinical"."is_valid_cpf"(value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  digits TEXT := regexp_replace(value, '[^0-9]', '', 'g');
  total INTEGER;
  remainder INTEGER;
  expected INTEGER;
  position INTEGER;
BEGIN
  IF digits !~ '^[0-9]{11}$' OR digits ~ '^([0-9])\1{10}$' THEN
    RETURN FALSE;
  END IF;

  total := 0;
  FOR position IN 1..9 LOOP
    total := total + substring(digits, position, 1)::INTEGER * (11 - position);
  END LOOP;
  remainder := total % 11;
  expected := CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END;
  IF substring(digits, 10, 1)::INTEGER <> expected THEN
    RETURN FALSE;
  END IF;

  total := 0;
  FOR position IN 1..10 LOOP
    total := total + substring(digits, position, 1)::INTEGER * (12 - position);
  END LOOP;
  remainder := total % 11;
  expected := CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END;

  RETURN substring(digits, 11, 1)::INTEGER = expected;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "clinical"."patients"
    WHERE "clinical"."is_valid_cpf"("document")
    GROUP BY "tenant_id", regexp_replace("document", '[^0-9]', '', 'g')
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate valid patient CPFs exist after normalization. Resolve them per tenant before applying this migration.';
  END IF;
END $$;

UPDATE "clinical"."patients"
SET "normalized_document" = regexp_replace("document", '[^0-9]', '', 'g')
WHERE "clinical"."is_valid_cpf"("document");

CREATE UNIQUE INDEX "patients_tenant_id_document_key"
ON "clinical"."patients"("tenant_id", "normalized_document");

DROP FUNCTION "clinical"."is_valid_cpf"(TEXT);
