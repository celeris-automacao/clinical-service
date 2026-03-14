import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { GameController } from './game.controller';
import { GetPlayerStatsUseCase } from './application/use-cases/get-player-stats.use-case';
import { RecordsPlayerClinicalStatsAdapter } from './infrastructure/adapters/records-player-clinical-stats.adapter';
import { GameRepository } from './repositories/game.repository';
import { GAME_REPOSITORY, PLAYER_CLINICAL_STATS_PORT } from './game.tokens';

@Module({
  imports: [PrismaModule, RecordsModule],
  controllers: [GameController],
  providers: [
    GetPlayerStatsUseCase,
    {
      provide: GAME_REPOSITORY,
      useClass: GameRepository,
    },
    {
      provide: PLAYER_CLINICAL_STATS_PORT,
      useClass: RecordsPlayerClinicalStatsAdapter,
    },
  ],
  exports: [GetPlayerStatsUseCase, GAME_REPOSITORY],
})
export class GameModule {}
