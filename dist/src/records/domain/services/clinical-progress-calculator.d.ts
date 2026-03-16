export declare class ClinicalProgressCalculator {
    calculateDamageFromLatestRecords(records: Array<any>): number;
    calculateStats(records: Array<any>): {
        rank: string;
        currentLevel: number;
        progressPercentage: number;
        nextLevelThreshold: number;
        totalDamage: number;
        totalWeightLoss: number;
    };
    generateClinicalBossName(): string;
    private calculateRank;
    private calculateLevel;
    private calculateProgressToNextLevel;
}
