import { DashboardRepositoryPort } from '../ports/dashboard-repository.port';
export declare class GetRecentClaimsUseCase {
    private readonly repository;
    constructor(repository: DashboardRepositoryPort);
    execute(tenantId: string): Promise<any[]>;
}
