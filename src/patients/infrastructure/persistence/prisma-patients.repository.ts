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
            email: data.email,
            phone: data.phone,
            document: data.document,
            gender: data.gender,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
            address: data.address
              ? {
                  create: {
                    zipCode: data.address.zipCode,
                    street: data.address.street,
                    number: data.address.number,
                    complement: data.address.complement,
                    neighborhood: data.address.neighborhood,
                    city: data.address.city,
                    state: data.address.state,
                    country: data.address.country ?? 'BR',
                  },
                }
              : undefined,
            staffLinks: data.assignedStaffId
              ? {
                  create: [
                    {
                      tenantId,
                      staffId: data.assignedStaffId,
                    },
                  ],
                }
              : undefined,
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

  async countByTenant(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.patient.count({
      where: { tenantId },
    });
  }

  async findBySupabaseId(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: id, tenantId }) as any;
    return prisma.patient.findFirst({ where: { id, tenantId } });
  }

  async findById(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: id, tenantId }) as any;
    return prisma.patient.findFirst({ where: { id, tenantId } });
  }

  async findAllByTenant(tenantId: string, search?: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.patient.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { document: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        profile: true,
      },
    });
  }

  async updateProfile(patientId: string, tenantId: string, data: UpdatePatientProfileDto) {
    await this.findById(patientId, tenantId);

    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId }) as any;
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
