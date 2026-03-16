import { UserContext } from '../../../shared/auth/user-context';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
export declare class GetPatientEvolutionUseCase {
    private readonly repository;
    constructor(repository: RecordsRepositoryPort);
    execute(user: UserContext): Promise<{
        recordedAt: Date;
        weight: number;
        skeletalMuscleMass: number;
        bodyFatMass: number;
    }[]>;
}
