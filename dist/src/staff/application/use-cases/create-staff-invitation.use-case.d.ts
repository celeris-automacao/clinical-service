import { CreateStaffInvitationDto } from '../../presentation/http/dto/create-staff-invitation.dto';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class CreateStaffInvitationUseCase {
    private readonly repository;
    private readonly auditLogPort;
    constructor(repository: StaffRepositoryPort, auditLogPort: StaffAuditLogPort);
    execute(dto: CreateStaffInvitationDto, tenantId: string, actorUserId: string): Promise<any>;
}
