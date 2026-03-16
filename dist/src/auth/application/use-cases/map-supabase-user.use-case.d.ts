import { GetStaffMemberByUserIdUseCase } from '../../../staff/application/use-cases/get-staff-member-by-user-id.use-case';
export declare class MapSupabaseUserUseCase {
    private readonly getStaffMemberByUserIdUseCase;
    constructor(getStaffMemberByUserIdUseCase: GetStaffMemberByUserIdUseCase);
    execute(payload: any): Promise<{
        userId: any;
        tenantId: any;
        role: any;
        staffId: any;
        email: any;
    }>;
}
