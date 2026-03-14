import { UserContext } from '../../../common/decorators/get-user.decorator';

export interface PlayerClinicalStatsPort {
  getStats(user: UserContext): Promise<{
    totalDamage: number;
  }>;
}
