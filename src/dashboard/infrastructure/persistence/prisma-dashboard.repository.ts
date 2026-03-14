// src/dashboard/infrastructure/persistence/prisma-dashboard.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IDashboardRepository } from '../../application/ports/dashboard-repository.port';

@Injectable()
export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countActivePlayers(tenantId: string, since: Date): Promise<number> {
    return this.prisma.playerStats.count({
      where: {
        tenantId,
        lastActivityAt: { gte: since }
      }
    });
  }

  async findRecentAchievements(tenantId: string, limit: number): Promise<any[]> {
    return this.prisma.socialPost.findMany({
      where: {
        tenantId,
        type: 'achievement'
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        patient: { select: { name: true } }
      }
    });
  }

  async findTopPlayers(tenantId: string, limit: number): Promise<any[]> {
    return this.prisma.playerStats.findMany({
      where: { tenantId },
      orderBy: { totalDamageDealt: 'desc' },
      take: limit,
      include: {
        patient: { select: { name: true } }
      }
    });
  }

  async getTaskCompletionsHistory(tenantId: string): Promise<any[]> {
    return this.prisma.taskCompletion.findMany({
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
    return this.prisma.rewardClaim.findMany({
      where: { tenantId },
      include: { reward: true },
      orderBy: { claimedAt: 'desc' },
      take: limit,
    });
  }
}
