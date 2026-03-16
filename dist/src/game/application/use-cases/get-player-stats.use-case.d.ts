import { UserContext } from '../../../shared/auth/user-context';
import { GameRepositoryPort } from '../ports/game-repository.port';
import { PlayerClinicalStatsPort } from '../ports/player-clinical-stats.port';
export declare class GetPlayerStatsUseCase {
    private readonly repository;
    private readonly playerClinicalStatsPort;
    constructor(repository: GameRepositoryPort, playerClinicalStatsPort: PlayerClinicalStatsPort);
    execute(user: UserContext): Promise<{
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
