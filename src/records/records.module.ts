// src/records/records.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { RecordsController } from './records.controller';
import { RecordsRepository } from './repositories/records.repository';  
import { RecordsService } from './records.service';
import { GameModule } from '../game/game.module';
import { AchievementsModule } from '../achievements/achievements.module'; // <--- IMPORTAÇÃO DO MÓDULO DE CONQUISTAS

@Module({
  imports: [
    forwardRef(() => GameModule),
    forwardRef(() => AchievementsModule), // <--- ADICIONE ESTA LINHA
  ],
  controllers: [RecordsController],
  providers: [
    RecordsService, 
    {
      /** Token de Injeção para desacoplamento */
      provide: 'IRecordsRepository',
      useClass: RecordsRepository,
    },
  ],
  exports: [RecordsService, 'IRecordsRepository'], // Exportando o token
})
export class RecordsModule {}