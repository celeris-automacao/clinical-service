import { UserContext } from '../../../shared/auth/user-context';

export interface PlayerClinicalStatsPort {
  getStats(user: UserContext): Promise<{
    totalDamage: number;
  }>;
}
