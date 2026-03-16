import { UserContext } from '../../../shared/auth/user-context';
import { RewardsRepositoryPort } from '../ports/rewards-repository.port';
import { RewardsStatsPort } from '../ports/rewards-stats.port';
export declare class GetAvailableRewardsUseCase {
    private readonly repository;
    private readonly rewardsStatsPort;
    constructor(repository: RewardsRepositoryPort, rewardsStatsPort: RewardsStatsPort);
    execute(user: UserContext): Promise<{
        unlocked: boolean;
        claimed: boolean;
        progress: number;
        id: string;
        tenantId: string;
        isActive: boolean;
        title: string;
        description: string | null;
        requiredDamage: number;
        goldCost: number;
        badgeIcon: string | null;
    }[]>;
}
