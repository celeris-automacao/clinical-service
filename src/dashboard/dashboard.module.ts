import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { NotificationsService } from './notifications.service';
import { DashboardRepository } from './repositories/dashboard.repository';
import { NotificationsRepository } from './repositories/notifications.repository';
import { GetClinicOverviewUseCase } from './application/use-cases/get-clinic-overview.use-case';
import { GetMissingPatientsUseCase } from './application/use-cases/get-missing-patients.use-case';
import { GetRecentClaimsUseCase } from './application/use-cases/get-recent-claims.use-case';
import { DASHBOARD_REPOSITORY, NOTIFICATIONS_REPOSITORY } from './dashboard.tokens';

@Module({
  controllers: [DashboardController],
  providers: [
    GetClinicOverviewUseCase,
    GetMissingPatientsUseCase,
    GetRecentClaimsUseCase,
    NotificationsService,
    {
      provide: DASHBOARD_REPOSITORY,
      useClass: DashboardRepository,
    },
    {
      provide: NOTIFICATIONS_REPOSITORY,
      useClass: NotificationsRepository,
    },
  ],
  exports: [
    GetClinicOverviewUseCase,
    GetMissingPatientsUseCase,
    GetRecentClaimsUseCase,
    DASHBOARD_REPOSITORY,
    NotificationsService,
    NOTIFICATIONS_REPOSITORY,
  ],
})
export class DashboardModule {}
