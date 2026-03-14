import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_REPOSITORY } from '../../dashboard.tokens';
import { IDashboardRepository } from '../../repositories/interfaces/dashboard.repository.interface';

@Injectable()
export class GetMissingPatientsUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly repository: IDashboardRepository,
  ) {}

  async execute(tenantId: string, daysInactive = 3) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysInactive);

    const activity = await this.repository.getTaskCompletionsHistory(tenantId);
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
