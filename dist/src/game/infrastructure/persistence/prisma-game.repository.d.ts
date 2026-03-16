import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { GameRepositoryPort } from '../../application/ports/game-repository.port';
export declare class PrismaGameRepository implements GameRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    findPlayerProgress(patientId: string, tenantId: string): Promise<{
        tenantId: string;
        patientId: string;
        currentLevel: number;
        currentXp: number;
        currentGold: number;
        currentStreak: number;
        lastActivityAt: Date;
        totalDamageDealt: import("@prisma/client/runtime/library").Decimal;
    }>;
    findActiveBoss(tenantId: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        maxHp: import("@prisma/client/runtime/library").Decimal;
        currentHp: import("@prisma/client/runtime/library").Decimal;
        isActive: boolean;
        defeatedAt: Date | null;
    }>;
}
