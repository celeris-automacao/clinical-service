export interface TasksAchievementsPort {
    checkLevelAchievements(input: {
        patientId: string;
        tenantId: string;
        newLevel: number;
    }): Promise<void>;
}
