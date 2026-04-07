import { CreateTenantDto } from '../../presentation/http/dto/create-tenant.dto';
export interface TenantsRepositoryPort {
    create(data: CreateTenantDto): Promise<any>;
    findById(id: string): Promise<any | null>;
    findAll(): Promise<any[]>;
    findByCnpj(cnpj: string): Promise<any | null>;
    findActivePlanById(planId: string): Promise<any | null>;
    updateStatus(id: string, status: string): Promise<any>;
    updatePlan(id: string, planId: string): Promise<any>;
}
