import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlayerProgressionPort } from '../../application/ports/player-progression.port';

@Injectable()
export class PrismaPlayerProgressionAdapter implements PlayerProgressionPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsertClinicalProgress(input: {
    patientId: string;
    tenantId: string;
    damageDealt: number;
  }): Promise<void> {
    await this.prisma.playerStats.upsert({
      where: { patientId: input.patientId },
      update: {
        totalDamageDealt: { increment: input.damageDealt },
        currentGold: { increment: input.damageDealt },
      },
      create: {
        patientId: input.patientId,
        tenantId: input.tenantId,
        totalDamageDealt: input.damageDealt,
        currentGold: input.damageDealt,
        currentLevel: 1,
        currentXp: 0,
      },
    });
  }
}
