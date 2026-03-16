import { DashboardRepositoryPort } from '../ports/dashboard-repository.port';
export declare class GetClinicOverviewUseCase {
    private readonly repository;
    constructor(repository: DashboardRepositoryPort);
    execute(tenantId: string): Promise<{
        activeToday: number;
        recentAchievements: {
            patient: any;
            content: any;
            date: any;
        }[];
        ranking: {
            name: any;
            damage: number;
            level: any;
        }[];
    }>;
}
