import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PlayerProgressionPort } from '../../application/ports/player-progression.port';
export declare class PrismaPlayerProgressionAdapter implements PlayerProgressionPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    upsertClinicalProgress(input: {
        patientId: string;
        tenantId: string;
        damageDealt: number;
    }): Promise<void>;
}
