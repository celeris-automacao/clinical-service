import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PlansRepositoryPort } from '../ports/plans-repository.port';
export declare class RequestPlanUpgradeUseCase {
    private readonly plansRepository;
    private readonly tenantScopedPrismaFactory;
    constructor(plansRepository: PlansRepositoryPort, tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    execute(tenantId: string, targetPlanId: string): Promise<any>;
}
