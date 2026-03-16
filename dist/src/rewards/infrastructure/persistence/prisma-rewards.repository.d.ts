import { Reward, RewardClaim } from '@prisma/client';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { RewardsRepositoryPort } from '../../application/ports/rewards-repository.port';
export declare class PrismaRewardsRepository implements RewardsRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    create(data: {
        tenantId: string;
        title: string;
        description?: string;
        requiredDamage: number;
        goldCost: number;
        badgeIcon?: string;
        isActive: boolean;
    }): Promise<Reward>;
    findAllActiveByTenant(tenantId: string): Promise<Reward[]>;
    findByTitle(title: string, tenantId: string): Promise<Reward | null>;
    findClaimsByPatient(patientId: string, tenantId: string): Promise<RewardClaim[]>;
    findById(rewardId: string, tenantId: string): Promise<Reward | null>;
    findSpecificClaim(rewardId: string, patientId: string, tenantId: string): Promise<RewardClaim | null>;
    createClaim(data: {
        rewardId: string;
        patientId: string;
        tenantId: string;
    }): Promise<RewardClaim>;
}
