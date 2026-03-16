import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { DashboardRepositoryPort } from '../../application/ports/dashboard-repository.port';
export declare class PrismaDashboardRepository implements DashboardRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    countActivePlayers(tenantId: string, since: Date): Promise<number>;
    findRecentAchievements(tenantId: string, limit: number): Promise<any[]>;
    findTopPlayers(tenantId: string, limit: number): Promise<any[]>;
    getTaskCompletionsHistory(tenantId: string): Promise<any[]>;
    findRecentClaims(tenantId: string, limit: number): Promise<any[]>;
}
