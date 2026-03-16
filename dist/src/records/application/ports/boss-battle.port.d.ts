export interface BossBattlePort {
    findActiveBoss(tenantId: string): Promise<{
        id: string;
        currentHp: number;
        maxHp: number;
    } | null>;
    findById(bossId: string, tenantId: string): Promise<{
        id: string;
        name: string;
        maxHp: number;
    } | null>;
    applyDamage(bossId: string, newHp: number, tenantId: string): Promise<void>;
    handleVictory(input: {
        bossId: string;
        tenantId: string;
        nextBossName: string;
        nextBossMaxHp: number;
        rewardGold: number;
    }): Promise<void>;
}
