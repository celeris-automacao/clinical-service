import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateClinicalRecordUseCase } from './application/use-cases/create-clinical-record.use-case';
import { CreateClinicalNoteUseCase } from './application/use-cases/create-clinical-note.use-case';
import { GetPatientEvolutionUseCase } from './application/use-cases/get-patient-evolution.use-case';
import { GetPatientClinicalNotesUseCase } from './application/use-cases/get-patient-clinical-notes.use-case';
import { GetPatientStatsUseCase } from './application/use-cases/get-patient-stats.use-case';
import { HandleBossVictoryUseCase } from './application/use-cases/handle-boss-victory.use-case';
import { GetPatientRecordsForDoctorUseCase } from './application/use-cases/get-patient-records-for-doctor.use-case';
import { UpdateClinicalNoteUseCase } from './application/use-cases/update-clinical-note.use-case';
import { UpdateLastRecordUseCase } from './application/use-cases/update-last-record.use-case';
import { ClinicalProgressCalculator } from './domain/services/clinical-progress-calculator';
import { RecordsAchievementsAdapter } from './infrastructure/adapters/records-achievements.adapter';
import { PrismaBossBattleAdapter } from './infrastructure/persistence/prisma-boss-battle.adapter';
import { PrismaPlayerProgressionAdapter } from './infrastructure/persistence/prisma-player-progression.adapter';
import { RecordsController } from './presentation/http/records.controller';
import { PrismaRecordsRepository } from './infrastructure/persistence/prisma-records.repository';
import {
  BOSS_BATTLE_PORT,
  PLAYER_PROGRESSION_PORT,
  RECORDS_ACHIEVEMENTS_PORT,
  RECORDS_REPOSITORY,
} from './records.tokens';

@Module({
  imports: [AchievementsModule],
  controllers: [RecordsController],
  providers: [
    RolesGuard,
    CreateClinicalRecordUseCase,
    CreateClinicalNoteUseCase,
    HandleBossVictoryUseCase,
    GetPatientStatsUseCase,
    GetPatientEvolutionUseCase,
    GetPatientClinicalNotesUseCase,
    GetPatientRecordsForDoctorUseCase,
    UpdateClinicalNoteUseCase,
    UpdateLastRecordUseCase,
    ClinicalProgressCalculator,
    {
      provide: RECORDS_REPOSITORY,
      useClass: PrismaRecordsRepository,
    },
    {
      provide: PLAYER_PROGRESSION_PORT,
      useClass: PrismaPlayerProgressionAdapter,
    },
    {
      provide: BOSS_BATTLE_PORT,
      useClass: PrismaBossBattleAdapter,
    },
    {
      provide: RECORDS_ACHIEVEMENTS_PORT,
      useClass: RecordsAchievementsAdapter,
    },
  ],
  exports: [HandleBossVictoryUseCase, GetPatientStatsUseCase, RECORDS_REPOSITORY],
})
export class RecordsModule {}
