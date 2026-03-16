import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { STAFF_AUDIT_LOG_PORT, STAFF_REPOSITORY } from '../../staff.tokens';
import { AcceptStaffInvitationDto } from '../../presentation/http/dto/accept-staff-invitation.dto';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class AcceptStaffInvitationUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
    @Inject(STAFF_AUDIT_LOG_PORT)
    private readonly auditLogPort: StaffAuditLogPort,
  ) {}

  async execute(dto: AcceptStaffInvitationDto, user: UserContext) {
    const invitation = await this.repository.findInvitationByToken(dto.token);
    if (!invitation) {
      throw new NotFoundException('Convite nao encontrado.');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Este convite nao esta mais pendente.');
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Este convite expirou.');
    }

    if (invitation.tenantId !== user.tenantId) {
      throw new BadRequestException('O convite nao pertence ao tenant autenticado.');
    }

    if (user.email && invitation.email !== user.email) {
      throw new BadRequestException('O email autenticado nao corresponde ao convite.');
    }

    const existingUser = await this.repository.findByUserId(user.userId, user.tenantId);
    if (existingUser) {
      throw new BadRequestException('Este usuario ja possui vinculo de staff na clinica.');
    }

    const existingDocument = await this.repository.findByDocument(invitation.document, user.tenantId);
    if (existingDocument) {
      throw new BadRequestException('Ja existe um profissional com este documento na clinica.');
    }

    if (invitation.licenseNumber) {
      const existingLicense = await this.repository.findByLicenseNumber(
        invitation.licenseNumber,
        user.tenantId,
      );
      if (existingLicense) {
        throw new BadRequestException('Ja existe um profissional com este registro na clinica.');
      }
    }

    const staffMember = await this.repository.create({
      tenantId: user.tenantId,
      userId: user.userId,
      name: invitation.name,
      document: invitation.document,
      email: invitation.email,
      professionalType: invitation.professionalType,
      specialty: invitation.specialty,
      role: invitation.role,
      licenseNumber: invitation.licenseNumber || undefined,
      status: 'active',
    });

    await this.repository.acceptInvitation(dto.token, user.userId, user.tenantId);

    await this.auditLogPort.create({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      targetStaffId: staffMember.id,
      action: 'staff.invitation_accepted',
      metadata: {
        invitationId: invitation.id,
      },
    });

    return staffMember;
  }
}
