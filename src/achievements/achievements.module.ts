// src/achievements/achievements.module.ts
import { Module } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { AchievementsRepository } from './repositories/achievements.repository';
import { forwardRef } from '@nestjs/common';
import { RecordsModule } from '../records/records.module'; // <--- IMPORTAÇÃO DO MÓDULO DE REGISTROS

@Module({
  imports: [
    forwardRef(() => RecordsModule), // <--- ADICIONE PARA RECIPROCIDADE
  ],
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