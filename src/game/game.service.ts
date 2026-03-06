import { Injectable, Inject } from '@nestjs/common';
import { IGameRepository } from './repositories/interfaces/game.repository.interface';
import { UserContext } from '../common/decorators/get-user.decorator';
import { RecordsService } from '../records/records.service';

@Injectable()
export class GameService {
  constructor(
    @Inject('IGameRepository')
    private readonly repository: IGameRepository,
    private readonly recordsService: RecordsService //
  ) {}

  async getPlayerStats(user: UserContext) {
    // 1. Busca estatísticas clínicas (Dano Total) via RecordsService
    const clinicalStats = await this.recordsService.getStats(user);

    // 2. Busca progresso e Boss via Repository
    const [playerProgress, currentBoss] = await Promise.all([
      this.repository.findPlayerProgress(user.userId),
      this.repository.findActiveBoss(user.tenantId)
    ]); //

    const currentLevel = playerProgress?.currentLevel || 1; //

    return {
      level: currentLevel, //
      currentXp: playerProgress?.currentXp || 0, //
      nextLevelXp: currentLevel * 1000, //
      totalDamageDealt: clinicalStats.totalDamage || 0, //
      boss: currentBoss ? {
        name: currentBoss.name, //
        hpPercentage: Math.max(0, Math.round((currentBoss.currentHp.toNumber() / currentBoss.maxHp.toNumber()) * 100)), //
        currentHp: Math.max(0, currentBoss.currentHp.toNumber()) //
      } : null
    };
  }
}