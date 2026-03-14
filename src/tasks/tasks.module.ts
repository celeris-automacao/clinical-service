import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { GameModule } from '../game/game.module';
import { RecordsModule } from '../records/records.module';
import { TasksController } from './tasks.controller';
import { CompleteTaskUseCase } from './application/use-cases/complete-task.use-case';
import { GetCategorizedRankingUseCase } from './application/use-cases/get-categorized-ranking.use-case';
import { GetDailyTasksUseCase } from './application/use-cases/get-daily-tasks.use-case';
import { GetRankingUseCase } from './application/use-cases/get-ranking.use-case';
import { GetTasksTodayUseCase } from './application/use-cases/get-tasks-today.use-case';
import { TasksAchievementsAdapter } from './infrastructure/adapters/tasks-achievements.adapter';
import { PrismaTaskCompletionTransactionAdapter } from './infrastructure/persistence/prisma-task-completion-transaction.adapter';
import { TasksRepository } from './repositories/tasks.repository';
import {
  TASK_COMPLETION_TRANSACTION_PORT,
  TASKS_ACHIEVEMENTS_PORT,
  TASKS_REPOSITORY,
} from './tasks.tokens';

@Module({
  imports: [GameModule, RecordsModule, AchievementsModule],
  controllers: [TasksController],
  providers: [
    CompleteTaskUseCase,
    GetCategorizedRankingUseCase,
    GetDailyTasksUseCase,
    GetRankingUseCase,
    GetTasksTodayUseCase,
    {
      provide: TASKS_REPOSITORY,
      useClass: TasksRepository,
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
