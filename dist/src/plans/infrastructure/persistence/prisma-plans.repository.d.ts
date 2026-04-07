import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { CreatePlanDto } from '../../presentation/http/dto/create-plan.dto';
import { PlansRepositoryPort } from '../../application/ports/plans-repository.port';
export declare class PrismaPlansRepository implements PlansRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    create(data: CreatePlanDto): Promise<any>;
    findAll(): Promise<any>;
    findById(id: string): Promise<any>;
    findByCode(code: string): Promise<any>;
    createUpgradeRequest(data: {
        tenantId: string;
        currentPlanId: string;
        targetPlanId: string;
    }): Promise<any>;
    findPendingUpgradeRequestByTenantId(tenantId: string): Promise<any>;
    findUpgradeRequests(status?: string): Promise<any>;
    findUpgradeRequestById(id: string): Promise<any>;
    updateUpgradeRequestStatus(id: string, status: string, resolvedBy?: string): Promise<any>;
}
