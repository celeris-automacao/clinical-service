import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { REWARDS_REPOSITORY, REWARDS_STATS_PORT } from '../../rewards.tokens';
import { RewardsRepositoryPort } from '../ports/rewards-repository.port';
import { RewardsStatsPort } from '../ports/rewards-stats.port';

@Injectable()
export class GetAvailableRewardsUseCase {
  constructor(
    @Inject(REWARDS_REPOSITORY)
    private readonly repository: RewardsRepositoryPort,
    @Inject(REWARDS_STATS_PORT)
    private readonly rewardsStatsPort: RewardsStatsPort,
  ) {}

  async execute(user: UserContext) {
    const stats = await this.rewardsStatsPort.getStats(user);

    const [rewards, claims] = await Promise.all([
      this.repository.findAllActiveByTenant(user.tenantId),
      this.repository.findClaimsByPatient(user.userId, user.tenantId),
    ]);

    return rewards.map((reward) => ({
      ...reward,
      unlocked: stats.totalDamage >= reward.requiredDamage,
      claimed: claims.some((claim) => claim.rewardId === reward.id),
      progress: Math.min(100, (stats.totalDamage / reward.requiredDamage) * 100),
    }));
  }
}
