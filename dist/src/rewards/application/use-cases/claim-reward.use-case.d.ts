import { UserContext } from '../../../shared/auth/user-context';
import { RewardsRepositoryPort } from '../ports/rewards-repository.port';
import { RewardClaimTransactionPort } from '../ports/reward-claim-transaction.port';
import { RewardsEventsPort } from '../ports/rewards-events.port';
export declare class ClaimRewardUseCase {
    private readonly repository;
    private readonly rewardClaimTransactionPort;
    private readonly rewardsEventsPort;
    constructor(repository: RewardsRepositoryPort, rewardClaimTransactionPort: RewardClaimTransactionPort, rewardsEventsPort: RewardsEventsPort);
    execute(rewardId: string, user: UserContext): Promise<{
        success: boolean;
        remainingGold: number;
    }>;
}
