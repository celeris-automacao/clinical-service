import { PrismaService } from '../../prisma/prisma.service';
import { IAchievementsRepository } from './interfaces/achievements.repository.interface';
export declare class AchievementsRepository implements IAchievementsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getOrCreateBadge(tenantId: string, title: string, icon: string): Promise<{
        id: string;
        tenantId: string;
        isActive: boolean;
        description: string | null;
        title: string;
        requiredDamage: number;
        goldCost: number;
        badgeIcon: string | null;
    }>;
    findClaim(patientId: string, rewardId: string): Promise<{
        id: string;
        tenantId: string;
        rewardId: string;
        patientId: string;
        claimedAt: Date;
    }>;
    createClaim(patientId: string, tenantId: string, rewardId: string): Promise<{
        id: string;
        tenantId: string;
        rewardId: string;
        patientId: string;
        claimedAt: Date;
    }>;
}
