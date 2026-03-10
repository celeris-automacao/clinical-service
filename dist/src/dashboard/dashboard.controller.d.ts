import { DashboardService } from './dashboard.service';
import { UserContext } from '../common/decorators/get-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
export declare class DashboardController {
    private readonly prisma;
    private readonly dashboardService;
    constructor(prisma: PrismaService, dashboardService: DashboardService);
    getOverview(user: UserContext): Promise<{
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
    getInactive(user: UserContext): Promise<{
        patientId: string;
        lastActivity: Date;
        status: string;
    }[]>;
    getRecentClaims(user: UserContext): Promise<({
        reward: {
            id: string;
            tenantId: string;
            isActive: boolean;
            description: string | null;
            title: string;
            requiredDamage: number;
            goldCost: number;
            badgeIcon: string | null;
        };
    } & {
        id: string;
        tenantId: string;
        rewardId: string;
        patientId: string;
        claimedAt: Date;
    })[]>;
    checkDoctorRole(user: UserContext): void;
}
