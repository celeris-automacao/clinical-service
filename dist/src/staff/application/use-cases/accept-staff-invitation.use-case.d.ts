import { UserContext } from '../../../shared/auth/user-context';
import { AcceptStaffInvitationDto } from '../../presentation/http/dto/accept-staff-invitation.dto';
import { StaffAuditLogPort } from '../ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class AcceptStaffInvitationUseCase {
    private readonly repository;
    private readonly auditLogPort;
    constructor(repository: StaffRepositoryPort, auditLogPort: StaffAuditLogPort);
    execute(dto: AcceptStaffInvitationDto, user: UserContext): Promise<any>;
}
