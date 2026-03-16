import { UserContext } from '../../../shared/auth/user-context';
import { GetPatientStatsUseCase } from '../../../records/application/use-cases/get-patient-stats.use-case';
import { RewardsStatsPort } from '../../application/ports/rewards-stats.port';
export declare class RecordsRewardsStatsAdapter implements RewardsStatsPort {
    private readonly getPatientStatsUseCase;
    constructor(getPatientStatsUseCase: GetPatientStatsUseCase);
    getStats(user: UserContext): Promise<{
        totalDamage: number;
    }>;
}
