/*
  Warnings:

  - You are about to drop the column `defeatedAt` on the `boss_battles` table. All the data in the column will be lost.
  - You are about to drop the column `currentGold` on the `player_stats` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "game"."boss_battles" DROP COLUMN "defeatedAt",
ADD COLUMN     "defeated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "game"."player_stats" DROP COLUMN "currentGold",
ADD COLUMN     "current_gold" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "access"."tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "clinical"."clinical_records" ADD CONSTRAINT "clinical_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical"."daily_tasks" ADD CONSTRAINT "daily_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical"."patients" ADD CONSTRAINT "patients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical"."staff" ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game"."boss_battles" ADD CONSTRAINT "boss_battles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game"."task_completions" ADD CONSTRAINT "task_completions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game"."rewards" ADD CONSTRAINT "rewards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game"."reward_claims" ADD CONSTRAINT "reward_claims_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game"."player_stats" ADD CONSTRAINT "player_stats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social"."social_posts" ADD CONSTRAINT "social_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
