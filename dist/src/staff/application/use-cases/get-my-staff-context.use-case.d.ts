import { UserContext } from '../../../shared/auth/user-context';
import { GetStaffMemberByUserIdUseCase } from './get-staff-member-by-user-id.use-case';
export declare class GetMyStaffContextUseCase {
    private readonly getStaffMemberByUserIdUseCase;
    constructor(getStaffMemberByUserIdUseCase: GetStaffMemberByUserIdUseCase);
    execute(user: UserContext): Promise<{
        userId: string;
        tenantId: string;
        role: string;
        email: string;
        staff: {
            id: any;
            name: any;
            role: any;
            status: any;
            specialty: any;
            professionalType: any;
            licenseNumber: any;
        };
    }>;
}
