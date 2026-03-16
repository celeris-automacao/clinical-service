ALTER TABLE "clinical"."staff"
  DROP CONSTRAINT IF EXISTS "staff_user_id_key";

ALTER TABLE "clinical"."staff"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "professional_type" TEXT NOT NULL DEFAULT 'doctor',
  ADD COLUMN "license_number" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "staff_tenant_id_user_id_key"
  ON "clinical"."staff"("tenant_id", "user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "staff_tenant_id_document_key"
  ON "clinical"."staff"("tenant_id", "document");

CREATE UNIQUE INDEX IF NOT EXISTS "staff_tenant_id_email_key"
  ON "clinical"."staff"("tenant_id", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "staff_tenant_id_license_number_key"
  ON "clinical"."staff"("tenant_id", "license_number");

CREATE TABLE IF NOT EXISTS "clinical"."staff_invitations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT NOT NULL,
  "professional_type" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "license_number" TEXT,
  "invited_by_user_id" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_invitations_token_key"
  ON "clinical"."staff_invitations"("token");

CREATE TABLE IF NOT EXISTS "clinical"."staff_audit_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "target_staff_id" UUID,
  "action" TEXT NOT NULL,
  "metadata" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_audit_logs_pkey" PRIMARY KEY ("id")
);
