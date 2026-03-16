CREATE TABLE "access"."plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "max_staff" INTEGER NOT NULL DEFAULT 5,
    "max_patients" INTEGER NOT NULL DEFAULT 100,
    "monthly_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_code_key" ON "access"."plans"("code");

ALTER TABLE "access"."tenants"
ADD COLUMN "legal_name" TEXT,
ADD COLUMN "cnpj" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "responsible_name" TEXT,
ADD COLUMN "responsible_email" TEXT,
ADD COLUMN "responsible_phone" TEXT,
ADD COLUMN "plan_id" UUID,
ADD COLUMN "activated_at" TIMESTAMP(3),
ADD COLUMN "deactivated_at" TIMESTAMP(3);

UPDATE "access"."tenants"
SET
  "legal_name" = "name",
  "cnpj" = CONCAT('PENDING-', "id"),
  "responsible_name" = 'Pendente',
  "responsible_email" = CONCAT("id", '@pending.local');

ALTER TABLE "access"."tenants"
ALTER COLUMN "legal_name" SET NOT NULL,
ALTER COLUMN "cnpj" SET NOT NULL,
ALTER COLUMN "responsible_name" SET NOT NULL,
ALTER COLUMN "responsible_email" SET NOT NULL;

CREATE UNIQUE INDEX "tenants_cnpj_key" ON "access"."tenants"("cnpj");

CREATE TABLE "access"."tenant_addresses" (
    "tenant_id" UUID NOT NULL,
    "zip_code" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',

    CONSTRAINT "tenant_addresses_pkey" PRIMARY KEY ("tenant_id")
);

ALTER TABLE "access"."tenant_addresses"
ADD CONSTRAINT "tenant_addresses_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access"."tenants"
ADD CONSTRAINT "tenants_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "access"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
