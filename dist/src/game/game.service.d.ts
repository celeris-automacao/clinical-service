import { IGameRepository } from './repositories/interfaces/game.repository.interface';
import { UserContext } from '../common/decorators/get-user.decorator';
import { RecordsService } from '../records/records.service';
export declare class GameService {
    private readonly repository;
    private readonly recordsService;
    constructor(repository: IGameRepository, recordsService: RecordsService);
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
