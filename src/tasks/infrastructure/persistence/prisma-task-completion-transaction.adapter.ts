import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { TaskCompletionTransactionPort } from '../../application/ports/task-completion-transaction.port';

@Injectable()
export class PrismaTaskCompletionTransactionAdapter implements TaskCompletionTransactionPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async execute(input: {
    taskId: string;
    patientId: string;
    tenantId: string;
    xpReward: number;
  }): Promise<{
    newXp: number;
    newLevel: number;
    leveledUp: boolean;
    bossDamage: number;
    defeatedBossId?: string;
  }> {
    return this.tenantScopedPrismaFactory.runInTenantTransaction(
      { userId: input.patientId, tenantId: input.tenantId },
      async (tx) => {
        await tx.taskCompletion.create({
          data: {
            taskId: input.taskId,
            patientId: input.patientId,
            tenantId: input.tenantId,
          },
        });

        const stats = await tx.playerStats.upsert({
          where: { patientId: input.patientId },
          update: {},
          create: {
            patientId: input.patientId,
            tenantId: input.tenantId,
            currentXp: 0,
            currentLevel: 1,
          },
        });

        const newXp = stats.currentXp + input.xpReward;
        const xpToNextLevel = stats.currentLevel * 1000;
        const leveledUp = newXp >= xpToNextLevel;
        const newLevel = leveledUp ? stats.currentLevel + 1 : stats.currentLevel;

        await tx.playerStats.update({
          where: { patientId: input.patientId },
          data: {
            currentXp: newXp,
            currentLevel: newLevel,
            totalDamageDealt: { increment: input.xpReward },
            currentGold: { increment: input.xpReward },
            lastActivityAt: new Date(),
          },
        });

        const activeBoss = await tx.bossBattle.findFirst({
          where: { tenantId: input.tenantId, isActive: true },
        });

        if (!activeBoss) {
          return {
            newXp,
            newLevel,
            leveledUp,
            bossDamage: 0,
          };
        }

        const newHp = Number(activeBoss.currentHp) - input.xpReward;

        if (newHp <= 0) {
          return {
            newXp,
            newLevel,
            leveledUp,
            bossDamage: input.xpReward,
            defeatedBossId: activeBoss.id,
          };
        }

        await tx.bossBattle.update({
          where: { id: activeBoss.id },
          data: { currentHp: newHp },
        });

        return {
          newXp,
          newLevel,
          leveledUp,
          bossDamage: input.xpReward,
        };
      },
    );
  }
}
