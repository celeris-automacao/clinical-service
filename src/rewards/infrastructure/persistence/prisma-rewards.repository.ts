import { Injectable } from '@nestjs/common';
import { Reward, RewardClaim } from '@prisma/client';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { byIdAndTenant, byPatientAndTenant, byTenant } from '../../../shared/infrastructure/persistence/tenant-scope';
import { RewardsRepositoryPort } from '../../application/ports/rewards-repository.port';

@Injectable()
export class PrismaRewardsRepository implements RewardsRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async findAllActiveByTenant(tenantId: string): Promise<Reward[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.reward.findMany({
      where: byTenant(tenantId, { isActive: true }),
    });
  }

  async findClaimsByPatient(patientId: string, tenantId: string): Promise<RewardClaim[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
    return prisma.rewardClaim.findMany({
      where: byPatientAndTenant(patientId, tenantId),
    });
  }

  async findById(rewardId: string, tenantId: string): Promise<Reward | null> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.reward.findFirst({
      where: byIdAndTenant(rewardId, tenantId),
    });
  }

  async findSpecificClaim(
    rewardId: string,
    patientId: string,
    tenantId: string,
  ): Promise<RewardClaim | null> {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
    return prisma.rewardClaim.findFirst({
      where: { rewardId, ...byPatientAndTenant(patientId, tenantId) },
    });
  }

  async createClaim(data: { rewardId: string; patientId: string; tenantId: string }): Promise<RewardClaim> {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({
      userId: data.patientId,
      tenantId: data.tenantId,
    });
    return prisma.rewardClaim.create({ data });
  }
}
