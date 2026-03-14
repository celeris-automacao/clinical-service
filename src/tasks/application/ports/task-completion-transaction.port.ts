export interface TaskCompletionTransactionPort {
  execute(input: {
    taskId: string;
    patientId: string;
    tenantId: string;
    xpReward: number;
  }): Promise<{
    newXp: number;
    newLevel: number;
    leveledUp: boolean;
    bossDamage: number;
    defeatedBossId?: string;
  }>;
}
