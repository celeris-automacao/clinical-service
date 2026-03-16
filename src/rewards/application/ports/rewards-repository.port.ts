import { Reward, RewardClaim } from '@prisma/client';

export interface RewardsRepositoryPort {
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
