import { Module } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { AchievementsRepository } from './repositories/achievements.repository';

@Module({
  providers: [
    AchievementsService,
    {
      provide: 'IAchievementsRepository',
      useClass: AchievementsRepository,
    },
  ],
  exports: [AchievementsService, 'IAchievementsRepository'],
})
export class AchievementsModule {}
