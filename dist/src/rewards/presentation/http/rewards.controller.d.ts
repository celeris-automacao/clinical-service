import { UserContext } from '../../../shared/auth/user-context';
import { ClaimRewardUseCase } from '../../application/use-cases/claim-reward.use-case';
import { CreateRewardUseCase } from '../../application/use-cases/create-reward.use-case';
import { GetAvailableRewardsUseCase } from '../../application/use-cases/get-available-rewards.use-case';
import { CreateRewardDto } from './dto/create-reward.dto';
export declare class RewardsController {
    private readonly createRewardUseCase;
    private readonly getAvailableRewardsUseCase;
    private readonly claimRewardUseCase;
    constructor(createRewardUseCase: CreateRewardUseCase, getAvailableRewardsUseCase: GetAvailableRewardsUseCase, claimRewardUseCase: ClaimRewardUseCase);
    create(dto: CreateRewardDto, user: UserContext): Promise<{
        id: string;
        tenantId: string;
        isActive: boolean;
        title: string;
        description: string | null;
        requiredDamage: number;
        goldCost: number;
        badgeIcon: string | null;
    }>;
    getAvailable(user: UserContext): Promise<{
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
    claim(rewardId: string, user: UserContext): Promise<{
        success: boolean;
        remainingGold: number;
    }>;
}
