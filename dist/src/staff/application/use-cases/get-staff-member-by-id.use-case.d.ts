import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class GetStaffMemberByIdUseCase {
    private readonly repository;
    constructor(repository: StaffRepositoryPort);
    execute(id: string, tenantId: string): Promise<any>;
}
