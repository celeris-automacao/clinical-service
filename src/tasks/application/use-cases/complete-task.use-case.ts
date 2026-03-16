import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  APPLICATION_EVENTS,
  createApplicationEvent,
} from '../../../shared/application/events/application-events';
import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { UserContext } from '../../../shared/auth/user-context';
import { APPLICATION_EVENT_BUS } from '../../../shared/shared.tokens';
import { HandleBossVictoryUseCase } from '../../../records/application/use-cases/handle-boss-victory.use-case';
import {
  TASK_COMPLETION_TRANSACTION_PORT,
  TASKS_ACHIEVEMENTS_PORT,
  TASKS_REPOSITORY,
} from '../../tasks.tokens';
import { TaskCompletionTransactionPort } from '../ports/task-completion-transaction.port';
import { TasksAchievementsPort } from '../ports/tasks-achievements.port';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';

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

  async execute(taskAssignmentId: string, user: UserContext) {
    const assignment = await this.repository.findAssignmentById(taskAssignmentId, user.tenantId);

    if (!assignment || assignment.patientId !== user.userId) {
      throw new BadRequestException('Missao nao encontrada.');
    }

    if (assignment.status === 'completed') {
      throw new BadRequestException('Voce ja completou esta missao.');
    }

    if (assignment.status !== 'pending') {
      throw new BadRequestException('A missao nao esta disponivel para conclusao.');
    }

    const result = await this.taskCompletionTransactionPort.execute({
      assignmentId: taskAssignmentId,
      patientId: user.userId,
      tenantId: user.tenantId,
      xpReward: assignment.template.xpReward,
    });

    if (result.defeatedBossId) {
      await this.handleBossVictoryUseCase.execute(result.defeatedBossId, user.tenantId, user.userId);
    }

    if (result.leveledUp) {
      await this.tasksAchievementsPort.checkLevelAchievements({
        patientId: user.userId,
        tenantId: user.tenantId,
        newLevel: result.newLevel,
      });
    }

    this.eventBus.publish(
      createApplicationEvent(APPLICATION_EVENTS.taskCompleted, {
        taskId: taskAssignmentId,
        userId: user.userId,
        tenantId: user.tenantId,
        xp: assignment.template.xpReward,
      }),
    );

    return {
      success: true,
      xp_earned: assignment.template.xpReward,
      current_xp: result.newXp,
      current_level: result.newLevel,
      level_up: result.leveledUp,
      boss_damage: result.bossDamage,
    };
  }
}
