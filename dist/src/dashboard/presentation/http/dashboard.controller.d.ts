import { UserContext } from '../../../shared/auth/user-context';
import { GetClinicOverviewUseCase } from '../../application/use-cases/get-clinic-overview.use-case';
import { GetMissingPatientsUseCase } from '../../application/use-cases/get-missing-patients.use-case';
import { GetRecentClaimsUseCase } from '../../application/use-cases/get-recent-claims.use-case';
export declare class DashboardController {
    private readonly getClinicOverviewUseCase;
    private readonly getMissingPatientsUseCase;
    private readonly getRecentClaimsUseCase;
    constructor(getClinicOverviewUseCase: GetClinicOverviewUseCase, getMissingPatientsUseCase: GetMissingPatientsUseCase, getRecentClaimsUseCase: GetRecentClaimsUseCase);
    getOverview(user: UserContext): Promise<{
        activeToday: number;
        recentAchievements: {
            patient: any;
            content: any;
            date: any;
        }[];
        ranking: {
            name: any;
            damage: number;
            level: any;
        }[];
    }>;
    getInactive(user: UserContext): Promise<{
        patientId: string;
        lastActivity: Date;
        status: string;
    }[]>;
    getRecentClaims(user: UserContext): Promise<any[]>;
    private checkDoctorRole;
}
