import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { CreatePlanDto } from '../../presentation/http/dto/create-plan.dto';
import { PlansRepositoryPort } from '../../application/ports/plans-repository.port';

@Injectable()
export class PrismaPlansRepository implements PlansRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async create(data: CreatePlanDto) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.plan.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAll() {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
    });
  }

  async findById(id: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.plan.findUnique({ where: { id } });
  }

  async findByCode(code: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.plan.findUnique({ where: { code } });
  }
}
