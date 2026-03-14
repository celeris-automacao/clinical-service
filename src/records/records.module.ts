import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { RecordsController } from './records.controller';
import { CreateClinicalRecordUseCase } from './application/use-cases/create-clinical-record.use-case';
import { GetPatientEvolutionUseCase } from './application/use-cases/get-patient-evolution.use-case';
import { GetPatientStatsUseCase } from './application/use-cases/get-patient-stats.use-case';
import { HandleBossVictoryUseCase } from './application/use-cases/handle-boss-victory.use-case';
import { ClinicalProgressCalculator } from './domain/services/clinical-progress-calculator';
import { RecordsAchievementsAdapter } from './infrastructure/adapters/records-achievements.adapter';
import { PrismaBossBattleAdapter } from './infrastructure/persistence/prisma-boss-battle.adapter';
import { PrismaPlayerProgressionAdapter } from './infrastructure/persistence/prisma-player-progression.adapter';
import { RecordsRepository } from './repositories/records.repository';
import { RecordsService } from './records.service';

@Module({
  imports: [AchievementsModule],
  controllers: [RecordsController],
  providers: [
    RecordsService,
    CreateClinicalRecordUseCase,
    HandleBossVictoryUseCase,
    GetPatientStatsUseCase,
    GetPatientEvolutionUseCase,
    ClinicalProgressCalculator,
    {
      provide: 'IRecordsRepository',
      useClass: RecordsRepository,
    },
    {
      provide: 'IPlayerProgressionPort',
      useClass: PrismaPlayerProgressionAdapter,
    },
    {
      provide: 'IBossBattlePort',
      useClass: PrismaBossBattleAdapter,
    },
    {
      provide: 'IRecordsAchievementsPort',
      useClass: RecordsAchievementsAdapter,
    },
  ],
  exports: [RecordsService, HandleBossVictoryUseCase, 'IRecordsRepository'],
})
export class RecordsModule {}
