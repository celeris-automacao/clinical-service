import { CreateStaffMemberDto } from '../../presentation/http/dto/create-staff-member.dto';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class CreateStaffMemberUseCase {
    private readonly repository;
    private readonly auditLogPort;
    constructor(repository: StaffRepositoryPort, auditLogPort: StaffAuditLogPort);
    execute(dto: CreateStaffMemberDto, tenantId: string, actorUserId?: string): Promise<any>;
}
