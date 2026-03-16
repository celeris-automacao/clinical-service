import { Module } from '@nestjs/common';
import { CheckLevelAchievementsUseCase } from './application/use-cases/check-level-achievements.use-case';
import { EmitBossDefeatedUseCase } from './application/use-cases/emit-boss-defeated.use-case';
import { EmitGlobalVictoryUseCase } from './application/use-cases/emit-global-victory.use-case';
import { ACHIEVEMENTS_EVENTS_PORT, ACHIEVEMENTS_REPOSITORY } from './achievements.tokens';
import { AchievementsEventsAdapter } from './infrastructure/adapters/achievements-events.adapter';
import { PrismaAchievementsRepository } from './infrastructure/persistence/prisma-achievements.repository';

@Module({
  providers: [
    CheckLevelAchievementsUseCase,
    EmitBossDefeatedUseCase,
    EmitGlobalVictoryUseCase,
    {
      provide: ACHIEVEMENTS_REPOSITORY,
      useClass: PrismaAchievementsRepository,
    },
    {
      provide: ACHIEVEMENTS_EVENTS_PORT,
      useClass: AchievementsEventsAdapter,
    },
  ],
  exports: [
    CheckLevelAchievementsUseCase,
    EmitBossDefeatedUseCase,
    EmitGlobalVictoryUseCase,
    ACHIEVEMENTS_REPOSITORY,
  ],
})
export class AchievementsModule {}
