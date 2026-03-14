import { Reward, RewardClaim } from '@prisma/client';

export interface RewardsRepositoryPort {
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
