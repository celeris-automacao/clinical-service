import { AssignTaskTemplateDto } from '../../presentation/http/dto/assign-task-template.dto';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
export declare class AssignTaskTemplateUseCase {
    private readonly repository;
    constructor(repository: TasksRepositoryPort);
    execute(dto: AssignTaskTemplateDto, tenantId: string, assignedByUserId: string): Promise<any>;
}
