import { UserContext } from '../../../shared/auth/user-context';
import { GetPlayerStatsUseCase } from '../../application/use-cases/get-player-stats.use-case';
export declare class GameController {
    private readonly getPlayerStatsUseCase;
    constructor(getPlayerStatsUseCase: GetPlayerStatsUseCase);
    getStats(user: UserContext): Promise<{
        level: any;
        currentXp: any;
        nextLevelXp: number;
        totalDamageDealt: number;
        boss: {
            name: any;
            hpPercentage: number;
            currentHp: number;
        };
    }>;
}
