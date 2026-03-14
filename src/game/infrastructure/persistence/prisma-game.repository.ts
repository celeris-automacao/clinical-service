import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { byPatientAndTenant, byTenant } from '../../../shared/infrastructure/persistence/tenant-scope';
import { GameRepositoryPort } from '../../application/ports/game-repository.port';

@Injectable()
export class PrismaGameRepository implements GameRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async findPlayerProgress(patientId: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
    return prisma.playerStats.findFirst({
      where: byPatientAndTenant(patientId, tenantId),
    });
  }

  async findActiveBoss(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.bossBattle.findFirst({
      where: byTenant(tenantId, { isActive: true }),
    });
  }
}
