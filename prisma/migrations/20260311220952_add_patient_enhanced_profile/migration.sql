-- CreateEnum
CREATE TYPE "clinical"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "clinical"."patients" ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "gender" "clinical"."Gender";

-- CreateTable
CREATE TABLE "clinical"."patient_profiles" (
    "patient_id" UUID NOT NULL,
    "initial_goals" TEXT,
    "symptoms" TEXT,
    "pathologies" TEXT,
    "medical_notes" TEXT,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("patient_id")
);

-- AddForeignKey
ALTER TABLE "clinical"."patient_profiles" ADD CONSTRAINT "patient_profiles_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinical"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
