import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class ChangeStaffMemberStatusUseCase {
    private readonly repository;
    private readonly auditLogPort;
    constructor(repository: StaffRepositoryPort, auditLogPort: StaffAuditLogPort);
    execute(id: string, tenantId: string, status: string, actorUserId?: string): Promise<any>;
}
