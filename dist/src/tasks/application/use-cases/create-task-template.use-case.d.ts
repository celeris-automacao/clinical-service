import { CreateTaskTemplateDto } from '../../presentation/http/dto/create-task-template.dto';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
export declare class CreateTaskTemplateUseCase {
    private readonly repository;
    constructor(repository: TasksRepositoryPort);
    execute(dto: CreateTaskTemplateDto, tenantId: string, createdByUserId: string): Promise<any>;
}
