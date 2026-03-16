export interface DashboardRepositoryPort {
    countActivePlayers(tenantId: string, since: Date): Promise<number>;
    findRecentAchievements(tenantId: string, limit: number): Promise<any[]>;
    findTopPlayers(tenantId: string, limit: number): Promise<any[]>;
    getTaskCompletionsHistory(tenantId: string): Promise<any[]>;
    findRecentClaims(tenantId: string, limit: number): Promise<any[]>;
}
