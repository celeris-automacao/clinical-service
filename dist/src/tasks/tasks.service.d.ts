import { ITasksRepository } from './repositories/interfaces/tasks.repository.interface';
import { IRecordsRepository } from '../records/repositories/interfaces/records.repository.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UserContext } from '../common/decorators/get-user.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AchievementsService } from '../achievements/achievements.service';
import { RecordsService } from '../records/records.service';
export declare class TasksService {
    private readonly repository;
    private readonly recordsRepository;
    private readonly prisma;
    private readonly eventEmitter;
    private readonly achievementsService;
    private readonly recordsService;
    constructor(repository: ITasksRepository, recordsRepository: IRecordsRepository, prisma: PrismaService, eventEmitter: EventEmitter2, achievementsService: AchievementsService, recordsService: RecordsService);
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
        boss_damage: number;
    }>;
    getCategorizedRanking(tenantId: string): Promise<{
        name: any;
        missionRank: any;
        clinicalRank: number;
        totalDamage: any;
        level: number;
    }[]>;
    private checkAndApplyBossDamage;
    getRanking(user: UserContext): Promise<{
        position: number;
        name: any;
        level: any;
        xp: any;
        damage: number;
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
