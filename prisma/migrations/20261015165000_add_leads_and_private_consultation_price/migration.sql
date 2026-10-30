ALTER TABLE "clinical"."staff"
ADD COLUMN "private_consultation_price" DECIMAL(10, 2);

CREATE TABLE "clinical"."leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_tenant_id_created_at_idx"
ON "clinical"."leads"("tenant_id", "created_at");

ALTER TABLE "clinical"."leads"
ADD CONSTRAINT "leads_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
