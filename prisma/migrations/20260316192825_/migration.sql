INSERT INTO "access"."plans" (
  "id", "name", "code", "description", "max_staff", "max_patients", "monthly_price", "is_active", "created_at", "updated_at"
)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  'Legacy',
  'legacy',
  'Plano padrao para tenants antigos',
  10,
  200,
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

UPDATE "access"."tenants"
SET "plan_id" = '40000000-0000-0000-0000-000000000001'
WHERE "plan_id" IS NULL;

ALTER TABLE "access"."tenants"
ALTER COLUMN "plan_id" SET NOT NULL;
