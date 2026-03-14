import { Injectable } from '@nestjs/common';
import { byIdAndTenant, byTenant } from '../../../shared/infrastructure/persistence/tenant-scope';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { BossBattlePort } from '../../application/ports/boss-battle.port';

@Injectable()
export class PrismaBossBattleAdapter implements BossBattlePort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async findActiveBoss(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    const boss = await prisma.bossBattle.findFirst({
      where: byTenant(tenantId, { isActive: true }),
    });

    if (!boss) {
      return null;
    }

    return {
      id: boss.id,
      currentHp: Number(boss.currentHp),
      maxHp: Number(boss.maxHp),
    };
  }

  async findById(bossId: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    const boss = await prisma.bossBattle.findFirst({
      where: byIdAndTenant(bossId, tenantId),
    });

    if (!boss) {
      return null;
    }

    return {
      id: boss.id,
      name: boss.name,
      maxHp: Number(boss.maxHp),
    };
  }

  async applyDamage(bossId: string, newHp: number, tenantId: string): Promise<void> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    await prisma.bossBattle.updateMany({
      where: byIdAndTenant(bossId, tenantId),
      data: { currentHp: newHp },
    });
  }

  async handleVictory(input: {
    bossId: string;
    tenantId: string;
    nextBossName: string;
    nextBossMaxHp: number;
    rewardGold: number;
  }): Promise<void> {
    await this.tenantScopedPrismaFactory.runInTenantTransaction(
      { userId: 'system', tenantId: input.tenantId },
      async (tx) => {
        await tx.bossBattle.update({
          where: { id: input.bossId },
          data: { isActive: false, currentHp: 0, defeatedAt: new Date() },
        });

        await tx.playerStats.updateMany({
          where: { tenantId: input.tenantId },
          data: { currentGold: { increment: input.rewardGold } },
        });

        await tx.bossBattle.create({
          data: {
            name: input.nextBossName,
            maxHp: input.nextBossMaxHp,
            currentHp: input.nextBossMaxHp,
            tenantId: input.tenantId,
            isActive: true,
          },
        });
      },
    );
  }
}
