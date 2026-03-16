import { TenantsRepositoryPort } from '../ports/tenants-repository.port';
export declare class GetTenantsUseCase {
    private readonly repository;
    constructor(repository: TenantsRepositoryPort);
    execute(): Promise<any[]>;
}
