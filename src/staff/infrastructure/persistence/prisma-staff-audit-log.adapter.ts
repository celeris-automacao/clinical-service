import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { StaffAuditLogPort } from '../../application/ports/staff-audit-log.port';

@Injectable()
export class PrismaStaffAuditLogAdapter implements StaffAuditLogPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async create(input: {
    tenantId: string;
    actorUserId: string;
    targetStaffId?: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({
      userId: input.actorUserId,
      tenantId: input.tenantId,
    }) as any;

    await prisma.staffAuditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        targetStaffId: input.targetStaffId,
        action: input.action,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  }
}
