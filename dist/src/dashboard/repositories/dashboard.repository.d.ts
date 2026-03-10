import { PrismaService } from '../../prisma/prisma.service';
import { IDashboardRepository } from './interfaces/dashboard.repository.interface';
export declare class DashboardRepository implements IDashboardRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    countActivePlayers(tenantId: string, since: Date): Promise<number>;
    findRecentAchievements(tenantId: string, limit: number): Promise<any[]>;
    findTopPlayers(tenantId: string, limit: number): Promise<any[]>;
    getTaskCompletionsHistory(tenantId: string): Promise<any[]>;
}
