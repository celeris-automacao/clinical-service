import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { DASHBOARD_REPOSITORY } from '../../dashboard.tokens';
import { DashboardRepositoryPort, DashboardQueryParams } from '../ports/dashboard-repository.port';

@Injectable()
export class GetMissingPatientsUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly repository: DashboardRepositoryPort,
  ) {}

  async execute(user: UserContext, daysInactive = 3) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysInactive);

    const params: DashboardQueryParams = { tenantId: user.tenantId };
    if (user.role !== 'admin' && user.staffId) {
      params.staffId = user.staffId;
    }

    const activity = await this.repository.getTaskCompletionsHistory(params);
    const lastActivities = new Map<string, Date>();

    activity.forEach((record) => {
      if (!lastActivities.has(record.patientId)) {
        lastActivities.set(record.patientId, record.completedAt);
      }
    });

    return Array.from(lastActivities.entries())
      .filter(([_, lastDate]) => lastDate < thresholdDate)
      .map(([patientId, lastDate]) => ({
        patientId,
        lastActivity: lastDate,
        status: 'Inativo',
      }));
  }
}
