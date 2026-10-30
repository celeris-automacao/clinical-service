ALTER TABLE "clinical"."staff"
ADD COLUMN "role_label" TEXT;

ALTER TABLE "clinical"."staff_invitations"
ADD COLUMN "role_label" TEXT;
