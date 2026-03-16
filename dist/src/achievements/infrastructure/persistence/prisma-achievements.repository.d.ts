import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { AchievementsRepositoryPort } from '../../application/ports/achievements-repository.port';
export declare class PrismaAchievementsRepository implements AchievementsRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    getOrCreateBadge(tenantId: string, title: string, icon: string): Promise<{
        id: string;
        tenantId: string;
        isActive: boolean;
        title: string;
        description: string | null;
        requiredDamage: number;
        goldCost: number;
        badgeIcon: string | null;
    }>;
    findClaim(patientId: string, rewardId: string): Promise<{
        id: string;
        tenantId: string;
        patientId: string;
        rewardId: string;
        claimedAt: Date;
    }>;
    createClaim(patientId: string, tenantId: string, rewardId: string): Promise<{
        id: string;
        tenantId: string;
        patientId: string;
        rewardId: string;
        claimedAt: Date;
    }>;
}
