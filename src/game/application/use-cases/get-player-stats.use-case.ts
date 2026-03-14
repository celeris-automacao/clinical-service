import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { GameRepositoryPort } from '../ports/game-repository.port';
import { PlayerClinicalStatsPort } from '../ports/player-clinical-stats.port';
import { GAME_REPOSITORY, PLAYER_CLINICAL_STATS_PORT } from '../../game.tokens';

@Injectable()
export class GetPlayerStatsUseCase {
  constructor(
    @Inject(GAME_REPOSITORY)
    private readonly repository: GameRepositoryPort,
    @Inject(PLAYER_CLINICAL_STATS_PORT)
    private readonly playerClinicalStatsPort: PlayerClinicalStatsPort,
  ) {}

  async execute(user: UserContext) {
    const clinicalStats = await this.playerClinicalStatsPort.getStats(user);

    const [playerProgress, currentBoss] = await Promise.all([
      this.repository.findPlayerProgress(user.userId, user.tenantId),
      this.repository.findActiveBoss(user.tenantId),
    ]);

    const currentLevel = playerProgress?.currentLevel || 1;

    return {
      level: currentLevel,
      currentXp: playerProgress?.currentXp || 0,
      nextLevelXp: currentLevel * 1000,
      totalDamageDealt: clinicalStats.totalDamage || 0,
      boss: currentBoss
        ? {
            name: currentBoss.name,
            hpPercentage: Math.max(
              0,
              Math.round((currentBoss.currentHp.toNumber() / currentBoss.maxHp.toNumber()) * 100),
            ),
            currentHp: Math.max(0, currentBoss.currentHp.toNumber()),
          }
        : null,
    };
  }
}
