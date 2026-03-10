import { PrismaService } from '../../prisma/prisma.service';
import { ITasksRepository } from './interfaces/tasks.repository.interface';
import { DailyTask, TaskCompletion } from '@prisma/client';
export declare class TasksRepository implements ITasksRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findTasksByTenant(tenantId: string): Promise<DailyTask[]>;
    findCompletionsByPatientToday(patientId: string, startOfDay: Date): Promise<TaskCompletion[]>;
    findSpecificCompletionToday(taskId: string, patientId: string, start: Date, end: Date): Promise<TaskCompletion | null>;
    findById(id: string): Promise<DailyTask | null>;
    findPendingTasksToday(userId: string, tenantId: string, today: Date): Promise<DailyTask[]>;
    getPlayerStatsRanking(tenantId: string): Promise<any[]>;
    findPatientsWithActivity(tenantId: string): Promise<any[]>;
}
