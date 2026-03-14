import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserContext } from '../common/decorators/get-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RecordsService } from '../records/records.service';
import { IRewardsRepository } from './repositories/interfaces/rewards.repository.interface';

@Injectable()
export class RewardsService {
  constructor(
    @Inject('IRewardsRepository')
    private readonly repository: IRewardsRepository,
    private readonly recordsService: RecordsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  async getAvailableRewards(user: UserContext) {
    const stats = await this.recordsService.getStats(user);

    const [rewards, claims] = await Promise.all([
      this.repository.findAllActiveByTenant(user.tenantId),
      this.repository.findClaimsByPatient(user.userId),
    ]);

    return rewards.map((reward) => ({
      ...reward,
      unlocked: stats.totalDamage >= reward.requiredDamage,
      claimed: claims.some((claim) => claim.rewardId === reward.id),
      progress: Math.min(100, (stats.totalDamage / reward.requiredDamage) * 100),
    }));
  }

  async claimReward(rewardId: string, user: UserContext) {
    const reward = await this.repository.findById(rewardId);
    if (!reward) {
      throw new BadRequestException('Recompensa não encontrada.');
    }

    const alreadyClaimed = await this.repository.findSpecificClaim(rewardId, user.userId);
    if (alreadyClaimed) {
      throw new BadRequestException('Você já resgatou esta recompensa!');
    }

    return this.prisma.$transaction(async (tx) => {
      const stats = await tx.playerStats.findUnique({
        where: { patientId: user.userId },
      });

      if (!stats) {
        throw new BadRequestException('Perfil do jogador não encontrado.');
      }

      const currentGold = Number(stats.currentGold);
      const totalDamage = Number(stats.totalDamageDealt);

      if (totalDamage < reward.requiredDamage) {
        throw new BadRequestException('Dano total insuficiente para desbloquear.');
      }

      if (currentGold < reward.goldCost) {
        throw new BadRequestException(`Saldo insuficiente. Você tem ${currentGold} moedas.`);
      }

      await tx.playerStats.update({
        where: { patientId: user.userId },
        data: { currentGold: { decrement: reward.goldCost } },
      });

      await this.repository.createClaim({
        rewardId,
        patientId: user.userId,
        tenantId: user.tenantId,
      });

      this.eventEmitter.emit('achievement.unlocked', {
        userId: user.userId,
        tenantId: user.tenantId,
        achievement: reward.title,
      });

      return {
        success: true,
        remainingGold: currentGold - reward.goldCost,
      };
    });
  }
}
