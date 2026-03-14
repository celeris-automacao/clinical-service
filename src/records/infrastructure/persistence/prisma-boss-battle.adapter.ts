import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BossBattlePort } from '../../application/ports/boss-battle.port';

@Injectable()
export class PrismaBossBattleAdapter implements BossBattlePort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveBoss(tenantId: string) {
    const boss = await this.prisma.bossBattle.findFirst({
      where: { tenantId, isActive: true },
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

  async findById(bossId: string) {
    const boss = await this.prisma.bossBattle.findUnique({
      where: { id: bossId },
    });

    if (!boss) {
      return null;
    }

    return {
      id: boss.id,
      maxHp: Number(boss.maxHp),
    };
  }

  async applyDamage(bossId: string, newHp: number): Promise<void> {
    await this.prisma.bossBattle.update({
      where: { id: bossId },
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
    await this.prisma.$transaction(async (tx) => {
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
    });
  }
}
