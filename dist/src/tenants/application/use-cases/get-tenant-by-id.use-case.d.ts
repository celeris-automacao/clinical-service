import { TenantsRepositoryPort } from '../ports/tenants-repository.port';
export declare class GetTenantByIdUseCase {
    private readonly repository;
    constructor(repository: TenantsRepositoryPort);
    execute(id: string): Promise<any>;
}
