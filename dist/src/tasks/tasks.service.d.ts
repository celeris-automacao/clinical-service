import { PrismaService } from '../prisma/prisma.service';
import { UserContext } from '../common/decorators/get-user.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AchievementsService } from '../game/achievements.service';
export declare class TasksService {
    private prisma;
    private eventEmitter;
    private achievementsService;
    constructor(prisma: PrismaService, eventEmitter: EventEmitter2, achievementsService: AchievementsService);
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
    getClinicRanking(tenantId: string): Promise<{
        patientId: string;
        totalDamage: number;
        bossName: string;
    }[]>;
    private checkBossStatus;
    getCategorizedRanking(tenantId: string): Promise<{
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
    getRanking(user: UserContext): Promise<{
        position: number;
        name: string;
        level: number;
        xp: number;
        damage: number;
    }[]>;
}
