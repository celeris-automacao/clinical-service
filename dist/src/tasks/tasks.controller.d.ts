import { TasksService } from './tasks.service';
import { UserContext } from '../common/decorators/get-user.decorator';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    getDailyTasks(user: UserContext): Promise<{
        completed: boolean;
        id: string;
        tenantId: string;
        isActive: boolean;
        description: string | null;
        title: string;
        patientId: string;
        taskType: string;
        xpReward: number;
        dueDate: Date;
        isCompleted: boolean;
        completedAt: Date | null;
        createdAt: Date;
    }[]>;
    completeTask(taskId: string, user: UserContext): Promise<{
        success: boolean;
        xp_earned: number;
        current_xp: number;
        current_level: number;
        level_up: boolean;
        message: string;
    }>;
    getRanking(user: UserContext): Promise<{
        position: number;
        name: string;
        level: number;
        xp: number;
        damage: number;
    }[]>;
    getDetailedRanking(user: UserContext): Promise<{
        name: string;
        missionRank: number;
        clinicalRank: number;
        totalDamage: number;
        level: number;
    }[]>;
    getTasksToday(user: UserContext): Promise<{
        id: string;
        tenantId: string;
        isActive: boolean;
        description: string | null;
        title: string;
        patientId: string;
        taskType: string;
        xpReward: number;
        dueDate: Date;
        isCompleted: boolean;
        completedAt: Date | null;
        createdAt: Date;
    }[]>;
}
