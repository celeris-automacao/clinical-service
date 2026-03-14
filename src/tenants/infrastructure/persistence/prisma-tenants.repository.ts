import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { TenantsRepositoryPort } from '../../application/ports/tenants-repository.port';
import { CreateTenantDto } from '../../presentation/http/dto/create-tenant.dto';

@Injectable()
export class PrismaTenantsRepository implements TenantsRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async create(data: CreateTenantDto) {
    const prisma = this.tenantScopedPrismaFactory.forRoot();
    return prisma.tenant.create({
      data: {
        name: data.name,
        bossBattles: {
          create: {
            name: 'Sedentarismo Voraz',
            maxHp: 100000,
            currentHp: 100000,
            isActive: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot();
    return prisma.tenant.findUnique({
      where: { id },
    });
  }

  async findAll() {
    const prisma = this.tenantScopedPrismaFactory.forRoot();
    return prisma.tenant.findMany({
      include: {
        _count: {
          select: { patients: true },
        },
      },
    });
  }
}
