import { TasksRepositoryPort } from '../ports/tasks-repository.port';
export declare class ListTaskTemplatesUseCase {
    private readonly repository;
    constructor(repository: TasksRepositoryPort);
    execute(tenantId: string): Promise<any[]>;
}
