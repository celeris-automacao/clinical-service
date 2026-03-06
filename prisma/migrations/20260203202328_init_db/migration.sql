-- CreateTable
CREATE TABLE "clinical_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight" DECIMAL(5,2) NOT NULL,
    "skeletal_muscle_mass" DECIMAL(5,2),
    "body_fat_mass" DECIMAL(5,2),

    CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);
