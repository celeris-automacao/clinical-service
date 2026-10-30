import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  async findTenantCurrentPlanId(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true },
    });
    return tenant?.planId ?? null;
  }

  async findPendingUpgradeRequest(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.planUpgradeRequest.findFirst({
      where: { tenantId, status: 'pending' },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async createUpgradeRequest(data: {
    tenantId: string;
    currentPlanId: string;
    targetPlanId: string;
    requestedByUserId: string;
  }) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    try {
      return await prisma.planUpgradeRequest.create({
        data: {
          ...data,
          status: 'pending',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A clinica ja possui uma solicitacao de plano pendente.',
        );
      }
      throw error;
    }
  }
}
