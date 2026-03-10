// src/tasks/tasks.module.ts
import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { GameModule } from '../game/game.module';
import { TasksRepository } from './repositories/tasks.repository';
import { RecordsModule } from '../records/records.module'; // Importa o módulo de registros para usar o serviço
import { AchievementsModule } from '../achievements/achievements.module'; // Importa o módulo de conquistas para usar o serviço

@Module({
  imports: [
    GameModule, 
    RecordsModule, 
    AchievementsModule // <--- ADICIONE ESTA LINHA
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    {
      provide: 'ITasksRepository',
      useClass: TasksRepository,
    },
  ],
  
  exports: [TasksService, 'ITasksRepository'], 
})
export class TasksModule {}