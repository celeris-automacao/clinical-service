import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { UserContext } from '../../../common/decorators/get-user.decorator';
import {
  REWARD_CLAIM_TRANSACTION_PORT,
  REWARDS_EVENTS_PORT,
  REWARDS_REPOSITORY,
} from '../../rewards.tokens';
import { IRewardsRepository } from '../ports/rewards-repository.port';
import { RewardClaimTransactionPort } from '../ports/reward-claim-transaction.port';
import { RewardsEventsPort } from '../ports/rewards-events.port';

@Injectable()
export class ClaimRewardUseCase {
  constructor(
    @Inject(REWARDS_REPOSITORY)
    private readonly repository: IRewardsRepository,
    @Inject(REWARD_CLAIM_TRANSACTION_PORT)
    private readonly rewardClaimTransactionPort: RewardClaimTransactionPort,
    @Inject(REWARDS_EVENTS_PORT)
    private readonly rewardsEventsPort: RewardsEventsPort,
  ) {}

  async execute(rewardId: string, user: UserContext) {
    const reward = await this.repository.findById(rewardId);
    if (!reward) {
      throw new BadRequestException('Recompensa não encontrada.');
    }

    const alreadyClaimed = await this.repository.findSpecificClaim(rewardId, user.userId);
    if (alreadyClaimed) {
      throw new BadRequestException('Você já resgatou esta recompensa!');
    }

    const result = await this.rewardClaimTransactionPort.claimReward({
      rewardId,
      patientId: user.userId,
      tenantId: user.tenantId,
      requiredDamage: reward.requiredDamage,
      goldCost: reward.goldCost,
    });

    await this.rewardsEventsPort.emitRewardClaimed({
      userId: user.userId,
      tenantId: user.tenantId,
      achievement: reward.title,
    });

    return {
      success: true,
      remainingGold: result.remainingGold,
    };
  }
}
