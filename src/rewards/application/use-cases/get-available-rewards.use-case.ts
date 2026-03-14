import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../common/decorators/get-user.decorator';
import { REWARDS_REPOSITORY, REWARDS_STATS_PORT } from '../../rewards.tokens';
import { IRewardsRepository } from '../ports/rewards-repository.port';
import { RewardsStatsPort } from '../ports/rewards-stats.port';

@Injectable()
export class GetAvailableRewardsUseCase {
  constructor(
    @Inject(REWARDS_REPOSITORY)
    private readonly repository: IRewardsRepository,
    @Inject(REWARDS_STATS_PORT)
    private readonly rewardsStatsPort: RewardsStatsPort,
  ) {}

  async execute(user: UserContext) {
    const stats = await this.rewardsStatsPort.getStats(user);

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
}
