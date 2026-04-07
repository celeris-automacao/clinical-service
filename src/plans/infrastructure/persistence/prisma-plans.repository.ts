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

  async createUpgradeRequest(data: { tenantId: string; currentPlanId: string; targetPlanId: string }) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.planUpgradeRequest.create({
      data: {
        tenantId: data.tenantId,
        currentPlanId: data.currentPlanId,
        targetPlanId: data.targetPlanId,
      },
    });
  }

  async findPendingUpgradeRequestByTenantId(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.planUpgradeRequest.findFirst({
      where: {
        tenantId,
        status: 'pending',
      },
      include: {
        targetPlan: true,
      },
    });
  }

  async findUpgradeRequests(status?: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.planUpgradeRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        tenant: true,
        currentPlan: true,
        targetPlan: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findUpgradeRequestById(id: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.planUpgradeRequest.findUnique({
      where: { id },
    });
  }

  async updateUpgradeRequestStatus(id: string, status: string, resolvedBy?: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.planUpgradeRequest.update({
      where: { id },
      data: {
        status,
        resolvedBy,
        resolvedAt: new Date(),
      },
    });
  }
}
