import { UserContext } from '../../../shared/auth/user-context';
import { CompleteTaskUseCase } from '../../application/use-cases/complete-task.use-case';
import { GetCategorizedRankingUseCase } from '../../application/use-cases/get-categorized-ranking.use-case';
import { GetDailyTasksUseCase } from '../../application/use-cases/get-daily-tasks.use-case';
import { GetRankingUseCase } from '../../application/use-cases/get-ranking.use-case';
import { GetTasksTodayUseCase } from '../../application/use-cases/get-tasks-today.use-case';
export declare class TasksController {
    private readonly getDailyTasksUseCase;
    private readonly completeTaskUseCase;
    private readonly getRankingUseCase;
    private readonly getCategorizedRankingUseCase;
    private readonly getTasksTodayUseCase;
    constructor(getDailyTasksUseCase: GetDailyTasksUseCase, completeTaskUseCase: CompleteTaskUseCase, getRankingUseCase: GetRankingUseCase, getCategorizedRankingUseCase: GetCategorizedRankingUseCase, getTasksTodayUseCase: GetTasksTodayUseCase);
    getDailyTasks(user: UserContext): Promise<any[]>;
    completeTask(taskAssignmentId: string, user: UserContext): Promise<{
        success: boolean;
        xp_earned: any;
        current_xp: number;
        current_level: number;
        level_up: boolean;
        boss_damage: number;
    }>;
    getRanking(user: UserContext): Promise<{
        position: number;
        name: any;
        level: any;
        xp: any;
        damage: number;
    }[]>;
    getDetailedRanking(user: UserContext): Promise<{
        name: any;
        missionRank: any;
        clinicalRank: number;
        totalDamage: any;
        level: number;
    }[]>;
    getTasksToday(user: UserContext): Promise<any[]>;
}
