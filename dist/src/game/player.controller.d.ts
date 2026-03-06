import { PlayerService } from './player.service';
import { UserContext } from '../common/decorators/get-user.decorator';
export declare class PlayerController {
    private readonly playerService;
    constructor(playerService: PlayerService);
    getStats(user: UserContext): Promise<{
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
