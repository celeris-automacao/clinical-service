import { PrismaService } from '../prisma/prisma.service';
import { UserContext } from '../common/decorators/get-user.decorator';
import { RecordsService } from '../records/records.service';
export declare class PlayerService {
    private prisma;
    private recordsService;
    constructor(prisma: PrismaService, recordsService: RecordsService);
    getPlayerStats(user: UserContext): Promise<{
        level: number;
        currentXp: number;
        nextLevelXp: number;
        totalDamageDealt: number;
        boss: {
            name: string;
            hpPercentage: number;
            currentHp: number;
        };
    }>;
}
