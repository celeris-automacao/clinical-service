import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PROTECTED_STAFF_ROLES } from '../../domain/staff.constants';
import { STAFF_AUDIT_LOG_PORT, STAFF_REPOSITORY } from '../../staff.tokens';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class ChangeStaffMemberStatusUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
    @Inject(STAFF_AUDIT_LOG_PORT)
    private readonly auditLogPort: StaffAuditLogPort,
  ) {}

  async execute(id: string, tenantId: string, status: string, actorUserId?: string) {
    const existingStaff = await this.repository.findById(id, tenantId);
    if (!existingStaff) {
      throw new NotFoundException('Profissional nao encontrado na clinica.');
    }

    const isProtectedRole = PROTECTED_STAFF_ROLES.includes(existingStaff.role);
    const isDeactivation = status !== 'active';

    if (isProtectedRole && existingStaff.status === 'active' && isDeactivation) {
      const activeCount = await this.repository.countActiveByRole(tenantId, existingStaff.role);
      if (activeCount <= 1) {
        throw new BadRequestException(
          `Nao e permitido inativar o ultimo ${existingStaff.role} ativo da clinica.`,
        );
      }
    }

    const updated = await this.repository.changeStatus(id, tenantId, status);

    if (actorUserId) {
      await this.auditLogPort.create({
        tenantId,
        actorUserId,
        targetStaffId: id,
        action: 'staff.status_changed',
        metadata: {
          previousStatus: existingStaff.status,
          newStatus: status,
        },
      });
    }

    return updated;
  }
}
