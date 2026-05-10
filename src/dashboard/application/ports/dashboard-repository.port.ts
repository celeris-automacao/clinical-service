export interface DashboardQueryParams {
  tenantId: string;
  staffId?: string;
}

export interface DashboardRepositoryPort {
  countActivePlayers(params: DashboardQueryParams, since: Date): Promise<number>;
  findRecentAchievements(params: DashboardQueryParams, limit: number): Promise<any[]>;
  findTopPlayers(params: DashboardQueryParams, limit: number): Promise<any[]>;
  getTaskCompletionsHistory(params: DashboardQueryParams): Promise<any[]>;
  findRecentClaims(params: DashboardQueryParams, limit: number): Promise<any[]>;
}
