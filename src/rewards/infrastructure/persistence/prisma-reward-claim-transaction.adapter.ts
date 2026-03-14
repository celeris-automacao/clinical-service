import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RewardClaimTransactionPort } from '../../application/ports/reward-claim-transaction.port';

@Injectable()
export class PrismaRewardClaimTransactionAdapter implements RewardClaimTransactionPort {
  constructor(private readonly prisma: PrismaService) {}

  async claimReward(input: {
    rewardId: string;
    patientId: string;
    tenantId: string;
    requiredDamage: number;
    goldCost: number;
  }): Promise<{ remainingGold: number }> {
    return this.prisma.$transaction(async (tx) => {
      const stats = await tx.playerStats.findUnique({
        where: { patientId: input.patientId },
      });

      if (!stats) {
        throw new BadRequestException('Perfil do jogador não encontrado.');
      }

      const currentGold = Number(stats.currentGold);
      const totalDamage = Number(stats.totalDamageDealt);

      if (totalDamage < input.requiredDamage) {
        throw new BadRequestException('Dano total insuficiente para desbloquear.');
      }

      if (currentGold < input.goldCost) {
        throw new BadRequestException(`Saldo insuficiente. Você tem ${currentGold} moedas.`);
      }

      await tx.playerStats.update({
        where: { patientId: input.patientId },
        data: { currentGold: { decrement: input.goldCost } },
      });

      await tx.rewardClaim.create({
        data: {
          rewardId: input.rewardId,
          patientId: input.patientId,
          tenantId: input.tenantId,
        },
      });

      return {
        remainingGold: currentGold - input.goldCost,
      };
    });
  }
}
