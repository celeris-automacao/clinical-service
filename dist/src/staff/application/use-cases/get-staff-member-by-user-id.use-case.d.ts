import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class GetStaffMemberByUserIdUseCase {
    private readonly repository;
    constructor(repository: StaffRepositoryPort);
    execute(userId: string, tenantId: string): Promise<any>;
}
