-- DropIndex
DROP INDEX "clinical"."staff_user_id_key";

-- AlterTable
ALTER TABLE "clinical"."staff" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clinical"."staff_invitations" ALTER COLUMN "updated_at" DROP DEFAULT;
