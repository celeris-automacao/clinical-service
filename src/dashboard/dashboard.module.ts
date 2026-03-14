import { Module } from '@nestjs/common';
import { DashboardRepository } from './infrastructure/persistence/prisma-dashboard.repository';
import { NotificationsRepository } from './infrastructure/persistence/prisma-notifications.repository';
import { GetClinicOverviewUseCase } from './application/use-cases/get-clinic-overview.use-case';
import { GetMissingPatientsUseCase } from './application/use-cases/get-missing-patients.use-case';
import { GetRecentClaimsUseCase } from './application/use-cases/get-recent-claims.use-case';
import { DashboardController } from './presentation/http/dashboard.controller';
import { NotificationsService } from './presentation/listeners/notifications.service';
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
