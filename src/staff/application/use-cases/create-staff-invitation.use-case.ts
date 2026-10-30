import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { STAFF_AUDIT_LOG_PORT, STAFF_REPOSITORY } from "../../staff.tokens";
import { EMAIL_SENDER } from "../../../email/email.tokens";
import { EmailSenderPort } from "../../../email/application/ports/email-sender.port";
import { CreateStaffInvitationDto } from "../../presentation/http/dto/create-staff-invitation.dto";
import { StaffAuditLogPort } from "../ports/staff-audit-log.port";
import { StaffRepositoryPort } from "../ports/staff-repository.port";

@Injectable()
export class CreateStaffInvitationUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
    @Inject(STAFF_AUDIT_LOG_PORT)
    private readonly auditLogPort: StaffAuditLogPort,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSenderPort,
  ) {}

  async execute(
    dto: CreateStaffInvitationDto,
    tenantId: string,
    actorUserId: string,
  ) {
    const existingStaff = await this.repository.findByEmail(
      dto.email,
      tenantId,
    );
    if (existingStaff) {
      throw new BadRequestException(
        "Ja existe um profissional com este email na clinica.",
      );
    }

    const existingInvitation =
      await this.repository.findPendingInvitationByEmail(dto.email, tenantId);
    if (existingInvitation) {
      throw new BadRequestException(
        "Ja existe um convite pendente para este email.",
      );
    }

    const existingDocument = await this.repository.findByDocument(
      dto.document,
      tenantId,
    );
    if (existingDocument) {
      throw new BadRequestException(
        "Ja existe um profissional com este documento na clinica.",
      );
    }

    const existingPendingDocument =
      await this.repository.findPendingInvitationByDocument(
        dto.document,
        tenantId,
      );
    if (existingPendingDocument) {
      throw new BadRequestException(
        "Ja existe um convite pendente para este documento.",
      );
    }

    if (dto.licenseNumber) {
      const existingLicense = await this.repository.findByLicenseNumber(
        dto.licenseNumber,
        tenantId,
      );
      if (existingLicense) {
        throw new BadRequestException(
          "Ja existe um profissional com este registro na clinica.",
        );
      }

      const existingPendingLicense =
        await this.repository.findPendingInvitationByLicenseNumber(
          dto.licenseNumber,
          tenantId,
        );
      if (existingPendingLicense) {
        throw new BadRequestException(
          "Ja existe um convite pendente para este registro.",
        );
      }
    }

    const invitation = await this.repository.createInvitation({
      ...dto,
      tenantId,
      invitedByUserId: actorUserId,
      token: randomUUID(),
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    try {
      await this.emailSender.sendStaffInvitation({
        email: invitation.email,
        name: invitation.name,
        role: invitation.roleLabel || invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      await this.repository.revokeInvitation(
        invitation.id,
        actorUserId,
        tenantId,
      );
      await this.auditLogPort.create({
        tenantId,
        actorUserId,
        action: "staff.invitation_email_failed",
        metadata: { invitationId: invitation.id },
      });
      throw error;
    }

    await this.auditLogPort.create({
      tenantId,
      actorUserId,
      action: "staff.invited",
      metadata: {
        invitationId: invitation.id,
        email: dto.email,
        document: dto.document,
        role: dto.role,
        roleLabel: dto.roleLabel,
      },
    });

    return invitation;
  }
}
