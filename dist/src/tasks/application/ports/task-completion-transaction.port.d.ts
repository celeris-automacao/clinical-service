export interface TaskCompletionTransactionPort {
    execute(input: {
        assignmentId: string;
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
