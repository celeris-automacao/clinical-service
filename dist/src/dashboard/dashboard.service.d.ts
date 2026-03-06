import { PrismaService } from '../prisma/prisma.service';
export declare class DashboardService {
    private prisma;
    constructor(prisma: PrismaService);
    getClinicOverview(tenantId: string): Promise<{
        activeToday: number;
        recentAchievements: {
            patient: string;
            content: string;
            date: Date;
        }[];
        ranking: {
            name: string;
            damage: number;
            level: number;
        }[];
    }>;
    getMissingPatients(tenantId: string, daysInactive?: number): Promise<{
        patientId: string;
        lastActivity: Date;
        status: string;
    }[]>;
}
