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
        isActive: boolean;
        description: string | null;
        title: string;
        requiredDamage: number;
        badgeIcon: string | null;
    }[]>;
    claim(rewardId: string, user: UserContext): Promise<{
        id: string;
        tenantId: string;
        rewardId: string;
        patientId: string;
        claimedAt: Date;
    }>;
}
