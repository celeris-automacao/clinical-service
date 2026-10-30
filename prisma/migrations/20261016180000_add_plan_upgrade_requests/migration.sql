CREATE TABLE "access"."plan_upgrade_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "current_plan_id" UUID NOT NULL,
    "target_plan_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_upgrade_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plan_upgrade_requests_tenant_id_status_requested_at_idx"
ON "access"."plan_upgrade_requests"("tenant_id", "status", "requested_at");

CREATE UNIQUE INDEX "plan_upgrade_requests_one_pending_per_tenant"
ON "access"."plan_upgrade_requests"("tenant_id")
WHERE "status" = 'pending';

ALTER TABLE "access"."plan_upgrade_requests"
ADD CONSTRAINT "plan_upgrade_requests_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "access"."plan_upgrade_requests"
ADD CONSTRAINT "plan_upgrade_requests_current_plan_id_fkey"
FOREIGN KEY ("current_plan_id") REFERENCES "access"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access"."plan_upgrade_requests"
ADD CONSTRAINT "plan_upgrade_requests_target_plan_id_fkey"
FOREIGN KEY ("target_plan_id") REFERENCES "access"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "game"."rewards"
SET
  "title" = 'Conquista de Saúde',
  "description" = 'Conquista por completar seu primeiro desafio.',
  "badge_icon" = 'heart-pulse'
WHERE "id" = '00000000-0000-0000-0000-000000000002';
