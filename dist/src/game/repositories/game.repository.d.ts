import { PrismaService } from '../../prisma/prisma.service';
import { IGameRepository } from './interfaces/game.repository.interface';
export declare class GameRepository implements IGameRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findPlayerProgress(patientId: string): Promise<{
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
