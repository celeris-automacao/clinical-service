// src/achievements/infrastructure/persistence/prisma-achievements.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IAchievementsRepository } from '../../repositories/interfaces/achievements.repository.interface';

@Injectable()
export class AchievementsRepository implements IAchievementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateBadge(tenantId: string, title: string, icon: string) {
    return this.prisma.reward.upsert({
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
    return this.prisma.rewardClaim.findFirst({
      where: { patientId, rewardId },
    });
  }

  async createClaim(patientId: string, tenantId: string, rewardId: string) {
    return this.prisma.rewardClaim.create({
      data: { rewardId, patientId, tenantId },
    });
  }
}
