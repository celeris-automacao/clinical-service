-- CreateTable
CREATE TABLE "clinical"."clinical_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "encounter_type" TEXT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "risk_level" TEXT,
    "next_steps" TEXT,
    "consultation_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_notes_tenant_id_patient_id_consultation_at_idx" ON "clinical"."clinical_notes"("tenant_id", "patient_id", "consultation_at");

-- AddForeignKey
ALTER TABLE "clinical"."clinical_notes" ADD CONSTRAINT "clinical_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical"."clinical_notes" ADD CONSTRAINT "clinical_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinical"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
