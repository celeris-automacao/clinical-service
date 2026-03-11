import { TasksService } from './tasks.service';
import { UserContext } from '../common/decorators/get-user.decorator';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    getDailyTasks(user: UserContext): Promise<{
        completed: boolean;
        id: string;
        tenantId: string;
        title: string;
        description: string | null;
        isActive: boolean;
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
    getTasksToday(user: UserContext): Promise<{
        id: string;
        tenantId: string;
        title: string;
        description: string | null;
        isActive: boolean;
        patientId: string;
        taskType: string;
        xpReward: number;
        dueDate: Date;
        isCompleted: boolean;
        completedAt: Date | null;
        createdAt: Date;
    }[]>;
}
