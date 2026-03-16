import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { TenantPlanPort } from '../../../shared/application/ports/tenant-plan.port';
import { TENANT_PLAN_PORT } from '../../../shared/shared.tokens';
import { STAFF_AUDIT_LOG_PORT, STAFF_REPOSITORY } from '../../staff.tokens';
import { CreateStaffMemberDto } from '../../presentation/http/dto/create-staff-member.dto';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class CreateStaffMemberUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
    @Inject(STAFF_AUDIT_LOG_PORT)
    private readonly auditLogPort: StaffAuditLogPort,
    @Inject(TENANT_PLAN_PORT)
    private readonly tenantPlanPort: TenantPlanPort,
  ) {}

  async execute(dto: CreateStaffMemberDto, tenantId: string, actorUserId?: string) {
    const [plan, staffCount] = await Promise.all([
      this.tenantPlanPort.getTenantPlan(tenantId),
      this.repository.countByTenant(tenantId),
    ]);

    if (!plan) {
      throw new BadRequestException('Clinica sem plano ativo.');
    }

    if (staffCount >= plan.maxStaff) {
      throw new BadRequestException('Limite de profissionais do plano atingido.');
    }

    const existingUser = await this.repository.findByUserId(dto.userId, tenantId);
    if (existingUser) {
      throw new BadRequestException('Ja existe um profissional com este usuario na clinica.');
    }

    const existingDocument = await this.repository.findByDocument(dto.document, tenantId);
    if (existingDocument) {
      throw new BadRequestException('Ja existe um profissional com este documento na clinica.');
    }

    if (dto.licenseNumber) {
      const existingLicense = await this.repository.findByLicenseNumber(dto.licenseNumber, tenantId);
      if (existingLicense) {
        throw new BadRequestException('Ja existe um profissional com este registro na clinica.');
      }
    }

    const staffMember = await this.repository.create({
      ...dto,
      tenantId,
      status: dto.status || 'active',
    });

    if (actorUserId) {
      await this.auditLogPort.create({
        tenantId,
        actorUserId,
        targetStaffId: staffMember.id,
        action: 'staff.created',
        metadata: {
          role: staffMember.role,
          professionalType: staffMember.professionalType,
        },
      });
    }

    return staffMember;
  }
}
