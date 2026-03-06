// src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './repositories/dashboard.repository';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './repositories/notifications.repository';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    NotificationsService,
    {
      provide: 'IDashboardRepository', // Token de Injeção
      useClass: DashboardRepository,
    },
    {
      provide: 'INotificationsRepository',
      useClass: NotificationsRepository,
    },
  ],
  exports: [DashboardService, 'IDashboardRepository'],
})
export class DashboardModule {}