import { Injectable } from '@nestjs/common';
import { TenantPlanPort } from '../../application/ports/tenant-plan.port';
import { TenantScopedPrismaFactory } from './tenant-scoped-prisma.factory';

@Injectable()
export class PrismaTenantPlanAdapter implements TenantPlanPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async getTenantPlan(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: {
          select: {
            id: true,
            maxStaff: true,
            maxPatients: true,
          },
        },
      },
    });

    return tenant?.plan ?? null;
  }
}
