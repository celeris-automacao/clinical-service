-- Backfill new generic participant columns from the legacy patient/doctor
-- pair before the old columns are dropped below. Ordered so the lower
-- users.id always lands in participant_a_user_id (matches the app-level
-- orderParticipants() convention and the new unique constraint).
UPDATE "conversations" c
SET "participant_a_user_id" = LEAST(p."user_id", d."user_id"),
    "participant_b_user_id" = GREATEST(p."user_id", d."user_id")
FROM "patients" p, "doctors" d
WHERE c."patient_id" = p."id"
  AND c."doctor_id" = d."id"
  AND c."participant_a_user_id" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "conversations" WHERE "participant_a_user_id" IS NULL OR "participant_b_user_id" IS NULL) THEN
    RAISE EXCEPTION 'conversations backfill left rows with a null participant; investigate before continuing';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_patient_doctor_unique";--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_patient_id_patients_id_fk";
--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_doctor_id_doctors_id_fk";
--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "participant_a_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "participant_b_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "patient_id";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "doctor_id";--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participants_clinic_unique" UNIQUE("participant_a_user_id","participant_b_user_id","clinic_id");
