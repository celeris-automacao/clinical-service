// src/tasks/repositories/interfaces/tasks.repository.interface.ts
import { DailyTask, TaskCompletion } from '@prisma/client';

export interface ITasksRepository {
  /** Busca tarefas ativas da clínica */
  findTasksByTenant(tenantId: string): Promise<DailyTask[]>;

  /** Busca todas as conclusões de um paciente no dia de hoje */
  findCompletionsByPatientToday(patientId: string, startOfDay: Date): Promise<TaskCompletion[]>;

  /** Verifica se uma tarefa específica já foi concluída hoje para evitar duplicidade (Anti-cheat) */
  findSpecificCompletionToday(
    taskId: string, 
    patientId: string, 
    start: Date, 
    end: Date
  ): Promise<TaskCompletion | null>;

  /** Busca uma tarefa pelo ID */
  findById(id: string): Promise<DailyTask | null>;

  /** Busca tarefas agendadas (pendentes) para o dia de hoje */
  findPendingTasksToday(userId: string, tenantId: string, today: Date): Promise<DailyTask[]>;

  /** Busca dados brutos para o ranking da clínica */
  getPlayerStatsRanking(tenantId: string): Promise<any[]>;

  /** Busca pacientes com atividades (usado no ranking categorizado) */
  findPatientsWithActivity(tenantId: string): Promise<any[]>;
}