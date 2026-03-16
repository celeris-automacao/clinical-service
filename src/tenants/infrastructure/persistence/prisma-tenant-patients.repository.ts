import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';

@Injectable()
export class PrismaTenantPatientsRepository {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async createWithStats(data: CreatePatientDto, tenantId: string) {
    return this.tenantScopedPrismaFactory.runInTenantTransaction(
      { userId: data.supabaseId, tenantId },
      async (tx) => {
        const patient = await tx.patient.create({
          data: {
            id: data.supabaseId,
            name: data.name,
            tenantId,
          },
        });

        await tx.playerStats.create({
          data: {
            patientId: patient.id,
            tenantId,
            currentLevel: 1,
            currentXp: 0,
            currentGold: 0,
            totalDamageDealt: 0,
          },
        });

        return patient;
      },
    );
  }

  async findBySupabaseId(id: string, tenantId?: string) {
    const prisma = tenantId
      ? this.tenantScopedPrismaFactory.forTenant(tenantId, id)
      : this.tenantScopedPrismaFactory.forRoot();
    return prisma.patient.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
  }
}
