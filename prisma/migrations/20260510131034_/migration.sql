-- AlterTable
ALTER TABLE "clinical"."clinical_records" ADD COLUMN     "recorded_by_user_id" UUID;

-- CreateTable
CREATE TABLE "clinical"."patient_staff_links" (
    "patient_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_staff_links_pkey" PRIMARY KEY ("patient_id","staff_id")
);

-- AddForeignKey
ALTER TABLE "clinical"."patient_staff_links" ADD CONSTRAINT "patient_staff_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinical"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical"."patient_staff_links" ADD CONSTRAINT "patient_staff_links_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "clinical"."staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical"."patient_staff_links" ADD CONSTRAINT "patient_staff_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
