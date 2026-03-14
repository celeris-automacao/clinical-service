import { Module } from '@nestjs/common';
import { CheckLevelAchievementsUseCase } from './application/use-cases/check-level-achievements.use-case';
import { EmitGlobalVictoryUseCase } from './application/use-cases/emit-global-victory.use-case';
import { AchievementsEventsAdapter } from './infrastructure/adapters/achievements-events.adapter';
import { AchievementsRepository } from './infrastructure/persistence/prisma-achievements.repository';
import { ACHIEVEMENTS_EVENTS_PORT, ACHIEVEMENTS_REPOSITORY } from './achievements.tokens';

@Module({
  providers: [
    CheckLevelAchievementsUseCase,
    EmitGlobalVictoryUseCase,
    {
      provide: ACHIEVEMENTS_REPOSITORY,
      useClass: AchievementsRepository,
    },
    {
      provide: ACHIEVEMENTS_EVENTS_PORT,
      useClass: AchievementsEventsAdapter,
    },
  ],
  exports: [
    CheckLevelAchievementsUseCase,
    EmitGlobalVictoryUseCase,
    ACHIEVEMENTS_REPOSITORY,
  ],
})
export class AchievementsModule {}
