import { DashboardRepositoryPort } from '../ports/dashboard-repository.port';
export declare class GetMissingPatientsUseCase {
    private readonly repository;
    constructor(repository: DashboardRepositoryPort);
    execute(tenantId: string, daysInactive?: number): Promise<{
        patientId: string;
        lastActivity: Date;
        status: string;
    }[]>;
}
