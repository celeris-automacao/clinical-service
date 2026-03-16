import { UserContext } from '../../../shared/auth/user-context';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
export declare class GetTasksTodayUseCase {
    private readonly repository;
    constructor(repository: TasksRepositoryPort);
    execute(user: UserContext): Promise<any[]>;
}
