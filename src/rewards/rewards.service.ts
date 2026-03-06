// src/rewards/rewards.service.ts
import { Injectable, Inject,forwardRef, BadRequestException } from '@nestjs/common';
import { IRewardsRepository } from './repositories/interfaces/rewards.repository.interface';
import { UserContext } from '../common/decorators/get-user.decorator';
import { RecordsService } from '../records/records.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service'

@Injectable()
export class RewardsService {
  constructor(
    @Inject('IRewardsRepository')
    private readonly repository: IRewardsRepository,
    private readonly recordsService: RecordsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AchievementsService))
    private readonly achievementsService: AchievementsService

  ) { }

  async getAvailableRewards(user: UserContext) {
    const stats = await this.recordsService.getStats(user);

    // Usando o Repository em vez do Prisma direto
    const [rewards, claims] = await Promise.all([
      this.repository.findAllActiveByTenant(user.tenantId),
      this.repository.findClaimsByPatient(user.userId),
    ]);

    return rewards.map(reward => ({
      ...reward,
      unlocked: stats.totalDamage >= reward.requiredDamage,
      claimed: claims.some(c => c.rewardId === reward.id),
      progress: Math.min(100, (stats.totalDamage / reward.requiredDamage) * 100)
    }));
  }

  

  async claimReward(rewardId: string, user: UserContext) {
    // 1. Validação inicial: Recompensa existe?
    const reward = await this.repository.findById(rewardId);
    if (!reward) throw new BadRequestException('Recompensa não encontrada.');

    // 2. NOVIDADE: Anti-Cheat - Já resgatou? (Resolve a Falha 1)
    const alreadyClaimed = await this.repository.findSpecificClaim(rewardId, user.userId);
    if (alreadyClaimed) throw new BadRequestException('Você já resgatou esta recompensa!');

    return await this.prisma.$transaction(async (tx) => {
      // 3. Busca os stats spendáveis
      const stats = await tx.playerStats.findUnique({
        where: { patientId: user.userId }
      });

      if (!stats) throw new BadRequestException('Perfil do jogador não encontrado.');

      // 4. Validação de Nível e Moedas (Conversão para Number evita o NaN)
      const currentGold = Number(stats.currentGold);
      const totalDamage = Number(stats.totalDamageDealt);

      if (totalDamage < reward.requiredDamage) {
        throw new BadRequestException('Dano total insuficiente para desbloquear.');
      }

      if (currentGold < reward.goldCost) {
        throw new BadRequestException(`Saldo insuficiente. Você tem ${currentGold} moedas.`);
      }

      // 5. Subtrai o valor e registra o resgate
      await tx.playerStats.update({
        where: { patientId: user.userId },
        data: { currentGold: { decrement: reward.goldCost } }
      });

      await this.repository.createClaim({
        rewardId,
        patientId: user.userId,
        tenantId: user.tenantId,
      });

      // 6. NOVIDADE: Emite o evento para o Mural Social (Resolve a Falha 2)
      this.eventEmitter.emit('achievement.unlocked', {
        userId: user.userId,
        tenantId: user.tenantId,
        achievement: reward.title, //
      });

      return {
        success: true,
        remainingGold: currentGold - reward.goldCost // Agora sem NaN!
      };
    });
  }
}