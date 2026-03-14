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
import { TasksService } from './tasks.service';

@Module({
  imports: [GameModule, RecordsModule, AchievementsModule],
  controllers: [TasksController],
  providers: [
    TasksService,
    CompleteTaskUseCase,
    GetCategorizedRankingUseCase,
    GetDailyTasksUseCase,
    GetRankingUseCase,
    GetTasksTodayUseCase,
    {
      provide: 'ITasksRepository',
      useClass: TasksRepository,
    },
    {
      provide: 'ITaskCompletionTransactionPort',
      useClass: PrismaTaskCompletionTransactionAdapter,
    },
    {
      provide: 'ITasksAchievementsPort',
      useClass: TasksAchievementsAdapter,
    },
  ],
  exports: [TasksService, 'ITasksRepository'],
})
export class TasksModule {}
