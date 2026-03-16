import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { RewardClaimTransactionPort } from '../../application/ports/reward-claim-transaction.port';
export declare class PrismaRewardClaimTransactionAdapter implements RewardClaimTransactionPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    claimReward(input: {
        rewardId: string;
        patientId: string;
        tenantId: string;
        requiredDamage: number;
        goldCost: number;
    }): Promise<{
        remainingGold: number;
    }>;
}
