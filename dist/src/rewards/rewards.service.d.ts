import { IRewardsRepository } from './repositories/interfaces/rewards.repository.interface';
import { UserContext } from '../common/decorators/get-user.decorator';
import { RecordsService } from '../records/records.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
export declare class RewardsService {
    private readonly repository;
    private readonly recordsService;
    private readonly eventEmitter;
    private readonly prisma;
    private readonly achievementsService;
    constructor(repository: IRewardsRepository, recordsService: RecordsService, eventEmitter: EventEmitter2, prisma: PrismaService, achievementsService: AchievementsService);
    getAvailableRewards(user: UserContext): Promise<{
        unlocked: boolean;
        claimed: boolean;
        progress: number;
        id: string;
        tenantId: string;
        title: string;
        description: string | null;
        requiredDamage: number;
        goldCost: number;
        badgeIcon: string | null;
        isActive: boolean;
    }[]>;
    claimReward(rewardId: string, user: UserContext): Promise<{
        success: boolean;
        remainingGold: number;
    }>;
}
