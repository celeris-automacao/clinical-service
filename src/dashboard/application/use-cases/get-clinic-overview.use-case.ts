import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_REPOSITORY } from '../../dashboard.tokens';
import { DashboardRepositoryPort } from '../ports/dashboard-repository.port';

@Injectable()
export class GetClinicOverviewUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly repository: DashboardRepositoryPort,
  ) {}

  async execute(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeCount, achievements, ranking] = await Promise.all([
      this.repository.countActivePlayers(tenantId, today),
      this.repository.findRecentAchievements(tenantId, 5),
      this.repository.findTopPlayers(tenantId, 3),
    ]);

    return {
      activeToday: activeCount,
      recentAchievements: achievements.map((achievement) => ({
        patient: achievement.patient.name,
        content: achievement.content,
        date: achievement.createdAt,
      })),
      ranking: ranking.map((player) => ({
        name: player.patient.name,
        damage: Number(player.totalDamageDealt),
        level: player.currentLevel,
      })),
    };
  }
}
