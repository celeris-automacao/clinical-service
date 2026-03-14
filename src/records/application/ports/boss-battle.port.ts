export interface BossBattlePort {
  findActiveBoss(tenantId: string): Promise<{
    id: string;
    currentHp: number;
    maxHp: number;
  } | null>;

  findById(bossId: string): Promise<{
    id: string;
    maxHp: number;
  } | null>;

  applyDamage(bossId: string, newHp: number): Promise<void>;

  handleVictory(input: {
    bossId: string;
    tenantId: string;
    nextBossName: string;
    nextBossMaxHp: number;
    rewardGold: number;
  }): Promise<void>;
}
