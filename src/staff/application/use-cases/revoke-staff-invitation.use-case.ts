import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STAFF_AUDIT_LOG_PORT, STAFF_REPOSITORY } from '../../staff.tokens';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class RevokeStaffInvitationUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
    @Inject(STAFF_AUDIT_LOG_PORT)
    private readonly auditLogPort: StaffAuditLogPort,
  ) {}

  async execute(id: string, tenantId: string, actorUserId: string) {
    const invitation = await this.repository.findInvitationById(id, tenantId);
    if (!invitation) {
      throw new NotFoundException('Convite nao encontrado.');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Apenas convites pendentes podem ser revogados.');
    }

    const revoked = await this.repository.revokeInvitation(id, actorUserId, tenantId);

    await this.auditLogPort.create({
      tenantId,
      actorUserId,
      action: 'staff.invitation_revoked',
      metadata: {
        invitationId: id,
        email: invitation.email,
      },
    });

    return revoked;
  }
}
