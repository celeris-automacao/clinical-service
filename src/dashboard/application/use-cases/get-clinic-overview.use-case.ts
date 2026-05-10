import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { DASHBOARD_REPOSITORY } from '../../dashboard.tokens';
import { DashboardRepositoryPort, DashboardQueryParams } from '../ports/dashboard-repository.port';

@Injectable()
export class GetClinicOverviewUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly repository: DashboardRepositoryPort,
  ) {}

  async execute(user: UserContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const params: DashboardQueryParams = { tenantId: user.tenantId };
    if (user.role !== 'admin' && user.staffId) {
      params.staffId = user.staffId;
    }

    const [activeCount, achievements, ranking] = await Promise.all([
      this.repository.countActivePlayers(params, today),
      this.repository.findRecentAchievements(params, 5),
      this.repository.findTopPlayers(params, 3),
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
