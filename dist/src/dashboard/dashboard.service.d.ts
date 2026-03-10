import { IDashboardRepository } from './repositories/interfaces/dashboard.repository.interface';
export declare class DashboardService {
    private readonly repository;
    constructor(repository: IDashboardRepository);
    getClinicOverview(tenantId: string): Promise<{
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
    getMissingPatients(tenantId: string, daysInactive?: number): Promise<{
        patientId: string;
        lastActivity: Date;
        status: string;
    }[]>;
}
