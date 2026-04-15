import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { DashboardRepositoryPort, DashboardQueryParams } from '../../application/ports/dashboard-repository.port';

@Injectable()
export class PrismaDashboardRepository implements DashboardRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async countActivePlayers(params: DashboardQueryParams, since: Date): Promise<number> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(params.tenantId);
    
    const where: any = {
      tenantId: params.tenantId,
      lastActivityAt: { gte: since },
    };
    if (params.staffId) {
      where.patient = { staffLinks: { some: { staffId: params.staffId, status: 'active' } } };
    }

    return prisma.playerStats.count({
      where,
    });
  }

  async findRecentAchievements(params: DashboardQueryParams, limit: number): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(params.tenantId);
    
    const where: any = {
      tenantId: params.tenantId,
      type: 'achievement',
    };
    if (params.staffId) {
      where.patient = { staffLinks: { some: { staffId: params.staffId, status: 'active' } } };
    }

    return prisma.socialPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        patient: { select: { name: true } },
      },
    });
  }

  async findTopPlayers(params: DashboardQueryParams, limit: number): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(params.tenantId);
    
    const where: any = { tenantId: params.tenantId };
    if (params.staffId) {
      where.patient = { staffLinks: { some: { staffId: params.staffId, status: 'active' } } };
    }

    return prisma.playerStats.findMany({
      where,
      orderBy: { totalDamageDealt: 'desc' },
      take: limit,
      include: {
        patient: { select: { name: true } },
      },
    });
  }

  async getTaskCompletionsHistory(params: DashboardQueryParams): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(params.tenantId);
    
    const where: any = { tenantId: params.tenantId };
    if (params.staffId) {
      where.patient = { staffLinks: { some: { staffId: params.staffId, status: 'active' } } };
    }

    return prisma.taskCompletion.findMany({
      where,
      select: {
        patientId: true,
        completedAt: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });
  }

  async findRecentClaims(params: DashboardQueryParams, limit: number): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(params.tenantId);
    
    const where: any = { tenantId: params.tenantId };
    if (params.staffId) {
      where.patient = { staffLinks: { some: { staffId: params.staffId, status: 'active' } } };
    }

    return prisma.rewardClaim.findMany({
      where,
      include: { reward: true },
      orderBy: { claimedAt: 'desc' },
      take: limit,
    });
  }
}
