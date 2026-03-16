import { UserContext } from '../../../shared/auth/user-context';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
export declare class GetRankingUseCase {
    private readonly repository;
    constructor(repository: TasksRepositoryPort);
    execute(user: UserContext): Promise<{
        position: number;
        name: any;
        level: any;
        xp: any;
        damage: number;
    }[]>;
}
