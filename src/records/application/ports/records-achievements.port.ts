export interface RecordsAchievementsPort {
  checkLevelAchievements(input: {
    patientId: string;
    tenantId: string;
    newLevel: number;
  }): Promise<void>;

  emitBossDefeated(input: {
    tenantId: string;
    bossId: string;
    bossName: string;
    killerId: string;
  }): Promise<void>;

  emitGlobalVictory(input: {
    tenantId: string;
    message: string;
  }): Promise<void>;
}
