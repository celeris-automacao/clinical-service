import { PrismaService } from '../../prisma/prisma.service';
import { IRewardsRepository } from './interfaces/rewards.repository.interface';
import { Reward, RewardClaim } from '@prisma/client';
export declare class RewardsRepository implements IRewardsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllActiveByTenant(tenantId: string): Promise<Reward[]>;
    findClaimsByPatient(patientId: string): Promise<RewardClaim[]>;
    findById(rewardId: string): Promise<Reward | null>;
    findSpecificClaim(rewardId: string, patientId: string): Promise<RewardClaim | null>;
    createClaim(data: {
        rewardId: string;
        patientId: string;
        tenantId: string;
    }): Promise<RewardClaim>;
}
