import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { TenantsRepositoryPort } from '../../application/ports/tenants-repository.port';
import { CreateTenantDto } from '../../presentation/http/dto/create-tenant.dto';
export declare class PrismaTenantsRepository implements TenantsRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    create(data: CreateTenantDto): Promise<any>;
    findByCnpj(cnpj: string): Promise<any>;
    findActivePlanById(planId: string): Promise<any>;
    updateStatus(id: string, status: string): Promise<any>;
    findById(id: string): Promise<any>;
    findAll(): Promise<any>;
}
