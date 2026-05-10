import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
import { TASKS_REPOSITORY } from '../../tasks.tokens';

@Injectable()
export class GetRankingUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
  ) {}

  async execute(user: UserContext) {
    const ranking = await this.repository.getPlayerStatsRanking(user.tenantId);

    return ranking.map((item, index) => ({
      position: index + 1,
      userId: item.patientId || item.patient?.id || `ranking-${index + 1}`,
      username: item.patient?.name || 'Heroi Anonimo',
      totalXp: item.currentXp,
      // Compatibilidade com consumidores antigos
      name: item.patient?.name || 'Heroi Anonimo',
      level: item.currentLevel,
      xp: item.currentXp,
      damage: Number(item.totalDamageDealt),
    }));
  }
}
