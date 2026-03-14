import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { AchievementsRepositoryPort } from '../../application/ports/achievements-repository.port';

@Injectable()
export class PrismaAchievementsRepository implements AchievementsRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async getOrCreateBadge(tenantId: string, title: string, icon: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.reward.upsert({
      where: { title_tenantId: { title, tenantId } },
      update: {},
      create: {
        tenantId,
        title,
        requiredDamage: 0,
        badgeIcon: icon,
        isActive: true,
      },
    });
  }

  async findClaim(patientId: string, rewardId: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot();
    return prisma.rewardClaim.findFirst({
      where: { patientId, rewardId },
    });
  }

  async createClaim(patientId: string, tenantId: string, rewardId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
    return prisma.rewardClaim.create({
      data: { rewardId, patientId, tenantId },
    });
  }
}
