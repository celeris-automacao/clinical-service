import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { BossBattlePort } from '../../application/ports/boss-battle.port';
export declare class PrismaBossBattleAdapter implements BossBattlePort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    findActiveBoss(tenantId: string): Promise<{
        id: string;
        currentHp: number;
        maxHp: number;
    }>;
    findById(bossId: string, tenantId: string): Promise<{
        id: string;
        name: string;
        maxHp: number;
    }>;
    applyDamage(bossId: string, newHp: number, tenantId: string): Promise<void>;
    handleVictory(input: {
        bossId: string;
        tenantId: string;
        nextBossName: string;
        nextBossMaxHp: number;
        rewardGold: number;
    }): Promise<void>;
}
