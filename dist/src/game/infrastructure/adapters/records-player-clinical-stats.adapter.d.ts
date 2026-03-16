import { UserContext } from '../../../shared/auth/user-context';
import { GetPatientStatsUseCase } from '../../../records/application/use-cases/get-patient-stats.use-case';
import { PlayerClinicalStatsPort } from '../../application/ports/player-clinical-stats.port';
export declare class RecordsPlayerClinicalStatsAdapter implements PlayerClinicalStatsPort {
    private readonly getPatientStatsUseCase;
    constructor(getPatientStatsUseCase: GetPatientStatsUseCase);
    getStats(user: UserContext): Promise<{
        totalDamage: number;
    }>;
}
