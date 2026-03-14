import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { DashboardRepositoryPort } from '../../application/ports/dashboard-repository.port';

@Injectable()
export class PrismaDashboardRepository implements DashboardRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async countActivePlayers(tenantId: string, since: Date): Promise<number> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.playerStats.count({
      where: {
        tenantId,
        lastActivityAt: { gte: since },
      },
    });
  }

  async findRecentAchievements(tenantId: string, limit: number): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.socialPost.findMany({
      where: {
        tenantId,
        type: 'achievement',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        patient: { select: { name: true } },
      },
    });
  }

  async findTopPlayers(tenantId: string, limit: number): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.playerStats.findMany({
      where: { tenantId },
      orderBy: { totalDamageDealt: 'desc' },
      take: limit,
      include: {
        patient: { select: { name: true } },
      },
    });
  }

  async getTaskCompletionsHistory(tenantId: string): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.taskCompletion.findMany({
      where: { tenantId },
      select: {
        patientId: true,
        completedAt: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });
  }

  async findRecentClaims(tenantId: string, limit: number): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.rewardClaim.findMany({
      where: { tenantId },
      include: { reward: true },
      orderBy: { claimedAt: 'desc' },
      take: limit,
    });
  }
}
