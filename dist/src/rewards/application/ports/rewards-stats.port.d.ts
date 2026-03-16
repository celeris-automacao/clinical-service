import { UserContext } from '../../../shared/auth/user-context';
export interface RewardsStatsPort {
    getStats(user: UserContext): Promise<{
        totalDamage: number;
    }>;
}
