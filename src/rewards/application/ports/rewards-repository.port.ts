import { Reward, RewardClaim } from '@prisma/client';

export interface RewardsRepositoryPort {
  findAllActiveByTenant(tenantId: string): Promise<Reward[]>;
  findClaimsByPatient(patientId: string, tenantId: string): Promise<RewardClaim[]>;
  findById(rewardId: string, tenantId: string): Promise<Reward | null>;
  findSpecificClaim(rewardId: string, patientId: string, tenantId: string): Promise<RewardClaim | null>;
  createClaim(data: {
    rewardId: string;
    patientId: string;
    tenantId: string;
  }): Promise<RewardClaim>;
}
