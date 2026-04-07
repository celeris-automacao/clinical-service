import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { TenantsRepositoryPort } from '../../application/ports/tenants-repository.port';
import { CreateTenantDto } from '../../presentation/http/dto/create-tenant.dto';

@Injectable()
export class PrismaTenantsRepository implements TenantsRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async create(data: CreateTenantDto) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.tenant.create({
      data: {
        name: data.name,
        legalName: data.legalName,
        cnpj: data.cnpj,
        responsibleName: data.responsibleName,
        responsibleEmail: data.responsibleEmail,
        responsiblePhone: data.responsiblePhone,
        status: 'active',
        activatedAt: new Date(),
        plan: {
          connect: {
            id: data.planId,
          },
        },
        address: {
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
        },
        bossBattles: {
          create: {
            name: 'Sedentarismo Voraz',
            maxHp: 100000,
            currentHp: 100000,
            isActive: true,
          },
        },
      },
      include: {
        plan: true,
        address: true,
      },
    });
  }

  async findByCnpj(cnpj: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.tenant.findUnique({
      where: { cnpj },
    });
  }

  async findActivePlanById(planId: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    });
  }

  async updateStatus(id: string, status: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.tenant.update({
      where: { id },
      data: {
        status,
        activatedAt: status === 'active' ? new Date() : undefined,
        deactivatedAt: status !== 'active' ? new Date() : null,
      },
      include: {
        plan: true,
        address: true,
      },
    });
  }

  async findById(id: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        address: true,
      },
    });
  }

  async findAll() {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.tenant.findMany({
      include: {
        plan: true,
        address: true,
        _count: {
          select: { patients: true, staff: true },
        },
      },
    });
  }

  async updatePlan(id: string, planId: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.tenant.update({
      where: { id },
      data: { planId },
    });
  }
}
