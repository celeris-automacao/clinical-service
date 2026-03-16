import { CreateTenantDto } from '../../presentation/http/dto/create-tenant.dto';
import { TenantsRepositoryPort } from '../ports/tenants-repository.port';
export declare class CreateTenantUseCase {
    private readonly repository;
    constructor(repository: TenantsRepositoryPort);
    execute(createTenantDto: CreateTenantDto): Promise<any>;
}
