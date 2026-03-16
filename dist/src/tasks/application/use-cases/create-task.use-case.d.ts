import { CreateTaskDto } from '../../presentation/http/dto/create-task.dto';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
export declare class CreateTaskUseCase {
    private readonly repository;
    constructor(repository: TasksRepositoryPort);
    execute(dto: CreateTaskDto, tenantId: string): Promise<{
        id: string;
        tenantId: string;
        patientId: string;
        title: string;
        description: string | null;
        taskType: string;
        xpReward: number;
        dueDate: Date;
        isCompleted: boolean;
        isActive: boolean;
        completedAt: Date | null;
        createdAt: Date;
    }>;
}
