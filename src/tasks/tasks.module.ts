import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { RecordsModule } from '../records/records.module';
import { AssignTaskTemplateUseCase } from './application/use-cases/assign-task-template.use-case';
import { BulkAssignTaskTemplateUseCase } from './application/use-cases/bulk-assign-task-template.use-case';
import { CompleteTaskUseCase } from './application/use-cases/complete-task.use-case';
import { CreateTaskTemplateUseCase } from './application/use-cases/create-task-template.use-case';
import { GetCategorizedRankingUseCase } from './application/use-cases/get-categorized-ranking.use-case';
import { GetDailyTasksUseCase } from './application/use-cases/get-daily-tasks.use-case';
import { GetRankingUseCase } from './application/use-cases/get-ranking.use-case';
import { GetTasksTodayUseCase } from './application/use-cases/get-tasks-today.use-case';
import { ListTaskTemplatesUseCase } from './application/use-cases/list-task-templates.use-case';
import { TasksAchievementsAdapter } from './infrastructure/adapters/tasks-achievements.adapter';
import { PrismaTaskCompletionTransactionAdapter } from './infrastructure/persistence/prisma-task-completion-transaction.adapter';
import { PrismaTasksRepository } from './infrastructure/persistence/prisma-tasks.repository';
import { TaskAssignmentsController } from './presentation/http/task-assignments.controller';
import { TaskTemplatesController } from './presentation/http/task-templates.controller';
import { TasksController } from './presentation/http/tasks.controller';
import {
  TASK_COMPLETION_TRANSACTION_PORT,
  TASKS_ACHIEVEMENTS_PORT,
  TASKS_REPOSITORY,
} from './tasks.tokens';

@Module({
  imports: [RecordsModule, AchievementsModule],
  controllers: [TasksController, TaskTemplatesController, TaskAssignmentsController],
  providers: [
    CreateTaskTemplateUseCase,
    ListTaskTemplatesUseCase,
    AssignTaskTemplateUseCase,
    BulkAssignTaskTemplateUseCase,
    CompleteTaskUseCase,
    GetCategorizedRankingUseCase,
    GetDailyTasksUseCase,
    GetRankingUseCase,
    GetTasksTodayUseCase,
    {
      provide: TASKS_REPOSITORY,
      useClass: PrismaTasksRepository,
    },
    {
      provide: TASK_COMPLETION_TRANSACTION_PORT,
      useClass: PrismaTaskCompletionTransactionAdapter,
    },
    {
      provide: TASKS_ACHIEVEMENTS_PORT,
      useClass: TasksAchievementsAdapter,
    },
  ],
  exports: [TASKS_REPOSITORY],
})
export class TasksModule {}
