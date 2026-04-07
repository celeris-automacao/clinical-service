import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PlansRepositoryPort } from '../ports/plans-repository.port';
export declare class ResolveUpgradeRequestUseCase {
    private readonly plansRepository;
    private readonly tenantScopedPrismaFactory;
    constructor(plansRepository: PlansRepositoryPort, tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    execute(id: string, action: 'approve' | 'reject', resolvedBy: string): Promise<any>;
}
