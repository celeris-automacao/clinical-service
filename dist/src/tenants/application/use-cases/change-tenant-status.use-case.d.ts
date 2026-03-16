import { TenantsRepositoryPort } from '../ports/tenants-repository.port';
export declare class ChangeTenantStatusUseCase {
    private readonly repository;
    constructor(repository: TenantsRepositoryPort);
    execute(id: string, status: string): Promise<any>;
}
