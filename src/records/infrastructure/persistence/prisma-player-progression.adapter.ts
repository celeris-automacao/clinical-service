import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PlayerProgressionPort } from '../../application/ports/player-progression.port';

@Injectable()
export class PrismaPlayerProgressionAdapter implements PlayerProgressionPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async upsertClinicalProgress(input: {
    patientId: string;
    tenantId: string;
    damageDealt: number;
  }): Promise<void> {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({
      userId: input.patientId,
      tenantId: input.tenantId,
    });

    await prisma.playerStats.upsert({
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
