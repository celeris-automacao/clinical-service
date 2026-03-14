import { Injectable } from '@nestjs/common';
import { UserContext } from '../common/decorators/get-user.decorator';
import { CompleteTaskUseCase } from './application/use-cases/complete-task.use-case';
import { GetCategorizedRankingUseCase } from './application/use-cases/get-categorized-ranking.use-case';
import { GetDailyTasksUseCase } from './application/use-cases/get-daily-tasks.use-case';
import { GetRankingUseCase } from './application/use-cases/get-ranking.use-case';
import { GetTasksTodayUseCase } from './application/use-cases/get-tasks-today.use-case';

@Injectable()
export class TasksService {
  constructor(
    private readonly getDailyTasksUseCase: GetDailyTasksUseCase,
    private readonly completeTaskUseCase: CompleteTaskUseCase,
    private readonly getRankingUseCase: GetRankingUseCase,
    private readonly getCategorizedRankingUseCase: GetCategorizedRankingUseCase,
    private readonly getTasksTodayUseCase: GetTasksTodayUseCase,
  ) {}

  async getDailyTasks(user: UserContext) {
    return this.getDailyTasksUseCase.execute(user);
  }

  async completeTask(taskId: string, user: UserContext) {
    return this.completeTaskUseCase.execute(taskId, user);
  }

  async getRanking(user: UserContext) {
    return this.getRankingUseCase.execute(user);
  }

  async getCategorizedRanking(tenantId: string) {
    return this.getCategorizedRankingUseCase.execute(tenantId);
  }

  async getTasksToday(user: UserContext) {
    return this.getTasksTodayUseCase.execute(user);
  }
}
