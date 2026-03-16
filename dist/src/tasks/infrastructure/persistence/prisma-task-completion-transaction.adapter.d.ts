import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { TaskCompletionTransactionPort } from '../../application/ports/task-completion-transaction.port';
export declare class PrismaTaskCompletionTransactionAdapter implements TaskCompletionTransactionPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
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
