import { CreateTenantUseCase } from '../../application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from '../../application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from '../../application/use-cases/get-tenants.use-case';
import { CreateTenantDto } from './dto/create-tenant.dto';
export declare class TenantsController {
    private readonly createTenantUseCase;
    private readonly getTenantsUseCase;
    private readonly getTenantByIdUseCase;
    constructor(createTenantUseCase: CreateTenantUseCase, getTenantsUseCase: GetTenantsUseCase, getTenantByIdUseCase: GetTenantByIdUseCase);
    create(createTenantDto: CreateTenantDto): Promise<any>;
    findAll(): Promise<any[]>;
    findOne(id: string): Promise<any>;
}
