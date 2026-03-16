import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { UserContext } from '../../../shared/auth/user-context';
import { HandleBossVictoryUseCase } from '../../../records/application/use-cases/handle-boss-victory.use-case';
import { TaskCompletionTransactionPort } from '../ports/task-completion-transaction.port';
import { TasksAchievementsPort } from '../ports/tasks-achievements.port';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
export declare class CompleteTaskUseCase {
    private readonly repository;
    private readonly taskCompletionTransactionPort;
    private readonly eventBus;
    private readonly tasksAchievementsPort;
    private readonly handleBossVictoryUseCase;
    constructor(repository: TasksRepositoryPort, taskCompletionTransactionPort: TaskCompletionTransactionPort, eventBus: ApplicationEventBusPort, tasksAchievementsPort: TasksAchievementsPort, handleBossVictoryUseCase: HandleBossVictoryUseCase);
    execute(taskAssignmentId: string, user: UserContext): Promise<{
        success: boolean;
        xp_earned: any;
        current_xp: number;
        current_level: number;
        level_up: boolean;
        boss_damage: number;
    }>;
}
