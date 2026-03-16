import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STAFF_AUDIT_LOG_PORT, STAFF_REPOSITORY } from '../../staff.tokens';
import { UpdateStaffMemberDto } from '../../presentation/http/dto/update-staff-member.dto';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class UpdateStaffMemberUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
    @Inject(STAFF_AUDIT_LOG_PORT)
    private readonly auditLogPort: StaffAuditLogPort,
  ) {}

  async execute(id: string, tenantId: string, dto: UpdateStaffMemberDto, actorUserId?: string) {
    const existingStaff = await this.repository.findById(id, tenantId);
    if (!existingStaff) {
      throw new NotFoundException('Profissional nao encontrado na clinica.');
    }

    if (dto.document) {
      const existingDocument = await this.repository.findByDocument(dto.document, tenantId, id);
      if (existingDocument) {
        throw new BadRequestException('Ja existe um profissional com este documento na clinica.');
      }
    }

    if (dto.licenseNumber) {
      const existingLicense = await this.repository.findByLicenseNumber(dto.licenseNumber, tenantId, id);
      if (existingLicense) {
        throw new BadRequestException('Ja existe um profissional com este registro na clinica.');
      }
    }

    const updated = await this.repository.update(id, tenantId, dto);

    if (actorUserId) {
      await this.auditLogPort.create({
        tenantId,
        actorUserId,
        targetStaffId: id,
        action: 'staff.updated',
        metadata: dto as Record<string, unknown>,
      });
    }

    return updated;
  }
}
