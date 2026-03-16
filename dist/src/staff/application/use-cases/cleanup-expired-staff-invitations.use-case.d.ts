import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class CleanupExpiredStaffInvitationsUseCase {
    private readonly repository;
    constructor(repository: StaffRepositoryPort);
    execute(referenceDate?: Date): Promise<number>;
}
