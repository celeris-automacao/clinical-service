import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { APPLICATION_EVENT_BUS } from '../../../shared/shared.tokens';
import { HandleBossVictoryUseCase } from '../../../records/application/use-cases/handle-boss-victory.use-case';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
import {
  TASK_COMPLETION_TRANSACTION_PORT,
  TASKS_ACHIEVEMENTS_PORT,
  TASKS_REPOSITORY,
} from '../../tasks.tokens';
import { TaskCompletionTransactionPort } from '../ports/task-completion-transaction.port';
import { TasksAchievementsPort } from '../ports/tasks-achievements.port';

@Injectable()
export class CompleteTaskUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
    @Inject(TASK_COMPLETION_TRANSACTION_PORT)
    private readonly taskCompletionTransactionPort: TaskCompletionTransactionPort,
    @Inject(APPLICATION_EVENT_BUS)
    private readonly eventBus: ApplicationEventBusPort,
    @Inject(TASKS_ACHIEVEMENTS_PORT)
    private readonly tasksAchievementsPort: TasksAchievementsPort,
    private readonly handleBossVictoryUseCase: HandleBossVictoryUseCase,
  ) {}

  async execute(taskId: string, user: UserContext) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const alreadyCompleted = await this.repository.findSpecificCompletionToday(
      taskId,
      user.userId,
      startOfDay,
      endOfDay,
    );

    if (alreadyCompleted) {
      throw new BadRequestException('Voce ja completou esta missao hoje!');
    }

    const task = await this.repository.findById(taskId);
    if (!task) {
      throw new BadRequestException('Missao nao encontrada.');
    }

    const result = await this.taskCompletionTransactionPort.execute({
      taskId,
      patientId: user.userId,
      tenantId: user.tenantId,
      xpReward: task.xpReward,
    });

    if (result.defeatedBossId) {
      await this.handleBossVictoryUseCase.execute(result.defeatedBossId, user.tenantId);
    }

    if (result.leveledUp) {
      await this.tasksAchievementsPort.checkLevelAchievements({
        patientId: user.userId,
        tenantId: user.tenantId,
        newLevel: result.newLevel,
      });
    }

    this.eventBus.emit('task.completed', { taskId, userId: user.userId, xp: task.xpReward });

    return {
      success: true,
      xp_earned: task.xpReward,
      current_xp: result.newXp,
      current_level: result.newLevel,
      level_up: result.leveledUp,
      boss_damage: result.bossDamage,
    };
  }
}
