import { TenantPlanPort } from '../../application/ports/tenant-plan.port';
import { TenantScopedPrismaFactory } from './tenant-scoped-prisma.factory';
export declare class PrismaTenantPlanAdapter implements TenantPlanPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    getTenantPlan(tenantId: string): Promise<any>;
}
