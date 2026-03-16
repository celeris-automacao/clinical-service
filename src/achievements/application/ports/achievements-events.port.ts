export interface AchievementsEventsPort {
  emitAchievementUnlocked(input: {
    patientId: string;
    tenantId: string;
    achievement: string;
  }): Promise<void>;

  emitBossDefeated(input: {
    tenantId: string;
    bossId: string;
    bossName: string;
    killerId: string;
  }): Promise<void>;

  emitBossDefeatedGlobal(input: {
    tenantId: string;
    message: string;
    timestamp: Date;
  }): Promise<void>;
}
