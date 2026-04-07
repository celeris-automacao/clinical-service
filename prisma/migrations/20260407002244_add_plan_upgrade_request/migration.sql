-- CreateTable
CREATE TABLE "access"."plan_upgrade_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "current_plan_id" UUID NOT NULL,
    "target_plan_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" UUID,
    "notes" TEXT,

    CONSTRAINT "plan_upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "access"."plan_upgrade_requests" ADD CONSTRAINT "plan_upgrade_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."plan_upgrade_requests" ADD CONSTRAINT "plan_upgrade_requests_current_plan_id_fkey" FOREIGN KEY ("current_plan_id") REFERENCES "access"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."plan_upgrade_requests" ADD CONSTRAINT "plan_upgrade_requests_target_plan_id_fkey" FOREIGN KEY ("target_plan_id") REFERENCES "access"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
