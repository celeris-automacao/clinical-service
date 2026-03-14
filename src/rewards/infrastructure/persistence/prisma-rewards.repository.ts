// src/rewards/infrastructure/persistence/prisma-rewards.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IRewardsRepository } from '../../repositories/interfaces/rewards.repository.interface';
import { Reward, RewardClaim } from '@prisma/client';

@Injectable()
export class PrismaRewardsRepository implements IRewardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActiveByTenant(tenantId: string): Promise<Reward[]> {
    return this.prisma.reward.findMany({
      where: { tenantId, isActive: true },
    });
  }

  async findClaimsByPatient(patientId: string): Promise<RewardClaim[]> {
    return this.prisma.rewardClaim.findMany({
      where: { patientId },
    });
  }

  async findById(rewardId: string): Promise<Reward | null> {
    return this.prisma.reward.findUnique({
      where: { id: rewardId },
    });
  }

  async findSpecificClaim(rewardId: string, patientId: string): Promise<RewardClaim | null> {
    return this.prisma.rewardClaim.findFirst({
      where: { rewardId, patientId },
    });
  }

  async createClaim(data: { rewardId: string; patientId: string; tenantId: string }): Promise<RewardClaim> {
    return this.prisma.rewardClaim.create({ data });
  }
}
