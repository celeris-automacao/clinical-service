export interface RecordsAchievementsPort {
  checkLevelAchievements(input: {
    patientId: string;
    tenantId: string;
    newLevel: number;
  }): Promise<void>;

  emitGlobalVictory(input: {
    tenantId: string;
    message: string;
  }): Promise<void>;
}
