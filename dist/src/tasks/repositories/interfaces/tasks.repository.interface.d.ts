import { DailyTask, TaskCompletion } from '@prisma/client';
export interface ITasksRepository {
    findTasksByTenant(tenantId: string): Promise<DailyTask[]>;
    findCompletionsByPatientToday(patientId: string, startOfDay: Date): Promise<TaskCompletion[]>;
    findSpecificCompletionToday(taskId: string, patientId: string, start: Date, end: Date): Promise<TaskCompletion | null>;
    findById(id: string): Promise<DailyTask | null>;
    findPendingTasksToday(userId: string, tenantId: string, today: Date): Promise<DailyTask[]>;
    getPlayerStatsRanking(tenantId: string): Promise<any[]>;
    findPatientsWithActivity(tenantId: string): Promise<any[]>;
}
