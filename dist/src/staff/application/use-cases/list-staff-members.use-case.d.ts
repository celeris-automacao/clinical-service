import { ListStaffMembersDto } from '../../presentation/http/dto/list-staff-members.dto';
import { StaffRepositoryPort } from '../ports/staff-repository.port';
export declare class ListStaffMembersUseCase {
    private readonly repository;
    constructor(repository: StaffRepositoryPort);
    execute(tenantId: string, filters: ListStaffMembersDto): Promise<any[]>;
}
