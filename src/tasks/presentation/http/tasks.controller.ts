import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { UserContext } from '../../../shared/auth/user-context';
import { CompleteTaskUseCase } from '../../application/use-cases/complete-task.use-case';
import { GetCategorizedRankingUseCase } from '../../application/use-cases/get-categorized-ranking.use-case';
import { GetDailyTasksUseCase } from '../../application/use-cases/get-daily-tasks.use-case';
import { GetRankingUseCase } from '../../application/use-cases/get-ranking.use-case';
import { GetTaskByIdUseCase } from '../../application/use-cases/get-task-by-id.use-case';
import { GetTasksTodayUseCase } from '../../application/use-cases/get-tasks-today.use-case';

@Controller('tasks')
@UseGuards(SupabaseGuard)
export class TasksController {
  constructor(
    private readonly getDailyTasksUseCase: GetDailyTasksUseCase,
    private readonly completeTaskUseCase: CompleteTaskUseCase,
    private readonly getRankingUseCase: GetRankingUseCase,
    private readonly getCategorizedRankingUseCase: GetCategorizedRankingUseCase,
    private readonly getTasksTodayUseCase: GetTasksTodayUseCase,
    private readonly getTaskByIdUseCase: GetTaskByIdUseCase,
  ) {}

  @Get()
  getDailyTasks(@GetUser() user: UserContext) {
    return this.getDailyTasksUseCase.execute(user);
  }

  @Post(':id/complete')
  completeTask(@Param('id') taskAssignmentId: string, @GetUser() user: UserContext) {
    return this.completeTaskUseCase.execute(taskAssignmentId, user);
  }

  @Get('ranking')
  getRanking(@GetUser() user: UserContext) {
    return this.getRankingUseCase.execute(user);
  }

  @Get('ranking/detailed')
  async getDetailedRanking(@GetUser() user: UserContext) {
    return this.getCategorizedRankingUseCase.execute(user.tenantId);
  }

  @Get('today')
  getTasksToday(@GetUser() user: UserContext) {
    return this.getTasksTodayUseCase.execute(user);
  }

  @Get(':id')
  getTaskById(@Param('id') taskAssignmentId: string, @GetUser() user: UserContext) {
    return this.getTaskByIdUseCase.execute(taskAssignmentId, user);
  }
}
