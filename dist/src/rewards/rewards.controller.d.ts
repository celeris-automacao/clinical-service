import { RewardsService } from './rewards.service';
import { UserContext } from '../common/decorators/get-user.decorator';
export declare class RewardsController {
    private readonly rewardsService;
    constructor(rewardsService: RewardsService);
    getAvailable(user: UserContext): Promise<{
        unlocked: boolean;
        claimed: boolean;
        progress: number;
        id: string;
        tenantId: string;
        title: string;
        description: string | null;
        requiredDamage: number;
        goldCost: number;
        badgeIcon: string | null;
        isActive: boolean;
    }[]>;
    claim(rewardId: string, user: UserContext): Promise<{
        success: boolean;
        remainingGold: number;
    }>;
}
