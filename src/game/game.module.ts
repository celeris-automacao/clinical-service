import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { GetPlayerStatsUseCase } from './application/use-cases/get-player-stats.use-case';
import { RecordsPlayerClinicalStatsAdapter } from './infrastructure/adapters/records-player-clinical-stats.adapter';
import { GameController } from './presentation/http/game.controller';
import { PrismaGameRepository } from './infrastructure/persistence/prisma-game.repository';
import { GAME_REPOSITORY, PLAYER_CLINICAL_STATS_PORT } from './game.tokens';

@Module({
  imports: [RecordsModule],
  controllers: [GameController],
  providers: [
    GetPlayerStatsUseCase,
    {
      provide: GAME_REPOSITORY,
      useClass: PrismaGameRepository,
    },
    {
      provide: PLAYER_CLINICAL_STATS_PORT,
      useClass: RecordsPlayerClinicalStatsAdapter,
    },
  ],
})
export class GameModule {}
