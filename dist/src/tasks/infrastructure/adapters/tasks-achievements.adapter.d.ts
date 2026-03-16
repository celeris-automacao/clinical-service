import { CheckLevelAchievementsUseCase } from '../../../achievements/application/use-cases/check-level-achievements.use-case';
import { TasksAchievementsPort } from '../../application/ports/tasks-achievements.port';
export declare class TasksAchievementsAdapter implements TasksAchievementsPort {
    private readonly checkLevelAchievementsUseCase;
    constructor(checkLevelAchievementsUseCase: CheckLevelAchievementsUseCase);
    checkLevelAchievements(input: {
        patientId: string;
        tenantId: string;
        newLevel: number;
    }): Promise<void>;
}
