import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PatientsRepositoryPort } from '../../application/ports/patients-repository.port';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../../presentation/http/dto/update-patient-profile.dto';

@Injectable()
export class PrismaPatientsRepository implements PatientsRepositoryPort {
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
            gender: data.gender,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
          },
        });

        await tx.playerStats.create({
          data: {
            patientId: patient.id,
            tenantId,
            currentLevel: 1,
          },
        });

        return patient;
      },
    );
  }

  async findBySupabaseId(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: id, tenantId });
    return prisma.patient.findFirst({ where: { id, tenantId } });
  }

  async findById(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: id, tenantId });
    return prisma.patient.findFirst({ where: { id, tenantId } });
  }

  async updateProfile(patientId: string, tenantId: string, data: UpdatePatientProfileDto) {
    await this.findById(patientId, tenantId);

    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
    return prisma.patientProfile.upsert({
      where: { patientId },
      update: data,
      create: {
        patientId,
        ...data,
      },
    });
  }
}
