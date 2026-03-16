import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { StaffAuditLogPort } from '../../application/ports/staff-audit-log.port';
export declare class PrismaStaffAuditLogAdapter implements StaffAuditLogPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    create(input: {
        tenantId: string;
        actorUserId: string;
        targetStaffId?: string;
        action: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
}
