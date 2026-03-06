import { PrismaService } from '../prisma/prisma.service';
import { UserContext } from '../common/decorators/get-user.decorator';
import { RecordsService } from '../records/records.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class RewardsService {
    private prisma;
    private recordsService;
    private eventEmitter;
    constructor(prisma: PrismaService, recordsService: RecordsService, eventEmitter: EventEmitter2);
    getAvailableRewards(user: UserContext): Promise<{
        unlocked: boolean;
        claimed: boolean;
        progress: number;
        id: string;
        tenantId: string;
        isActive: boolean;
        description: string | null;
        title: string;
        requiredDamage: number;
        badgeIcon: string | null;
    }[]>;
    claimReward(rewardId: string, user: UserContext): Promise<{
        id: string;
        tenantId: string;
        rewardId: string;
        patientId: string;
        claimedAt: Date;
    }>;
}
