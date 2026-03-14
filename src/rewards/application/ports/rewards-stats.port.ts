import { UserContext } from '../../../common/decorators/get-user.decorator';

export interface RewardsStatsPort {
  getStats(user: UserContext): Promise<{
    totalDamage: number;
  }>;
}
