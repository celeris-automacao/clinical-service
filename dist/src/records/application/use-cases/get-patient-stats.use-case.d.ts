import { UserContext } from '../../../shared/auth/user-context';
import { ClinicalProgressCalculator } from '../../domain/services/clinical-progress-calculator';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
export declare class GetPatientStatsUseCase {
    private readonly repository;
    private readonly clinicalProgressCalculator;
    constructor(repository: RecordsRepositoryPort, clinicalProgressCalculator: ClinicalProgressCalculator);
    execute(user: UserContext): Promise<{
        rank: string;
        currentLevel: number;
        progressPercentage: number;
        nextLevelThreshold: number;
        totalDamage: number;
        totalWeightLoss: number;
        patientId: string;
        recordsCount: number;
    }>;
}
