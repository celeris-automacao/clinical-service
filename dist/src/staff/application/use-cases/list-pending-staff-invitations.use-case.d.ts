import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class ListPendingStaffInvitationsUseCase {
    private readonly repository;
    constructor(repository: StaffRepositoryPort);
    execute(tenantId: string): Promise<any[]>;
}
