import { UpdateStaffMemberDto } from '../../presentation/http/dto/update-staff-member.dto';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class UpdateStaffMemberUseCase {
    private readonly repository;
    private readonly auditLogPort;
    constructor(repository: StaffRepositoryPort, auditLogPort: StaffAuditLogPort);
    execute(id: string, tenantId: string, dto: UpdateStaffMemberDto, actorUserId?: string): Promise<any>;
}
