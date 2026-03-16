import { RecordsRepositoryPort } from '../../../records/application/ports/records-repository.port';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
export declare class GetCategorizedRankingUseCase {
    private readonly repository;
    private readonly recordsRepository;
    constructor(repository: TasksRepositoryPort, recordsRepository: RecordsRepositoryPort);
    execute(tenantId: string): Promise<{
        name: any;
        missionRank: any;
        clinicalRank: number;
        totalDamage: any;
        level: number;
    }[]>;
}
