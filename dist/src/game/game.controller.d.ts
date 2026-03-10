import { GameService } from './game.service';
import { UserContext } from '../common/decorators/get-user.decorator';
export declare class GameController {
    private readonly gameService;
    constructor(gameService: GameService);
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
