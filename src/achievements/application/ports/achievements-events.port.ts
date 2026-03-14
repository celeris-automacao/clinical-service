export interface AchievementsEventsPort {
  emitAchievementUnlocked(input: {
    patientId: string;
    tenantId: string;
    achievement: string;
  }): Promise<void>;

  emitBossDefeatedGlobal(input: {
    tenantId: string;
    message: string;
    timestamp: Date;
  }): Promise<void>;
}
