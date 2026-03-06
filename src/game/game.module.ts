import { Module, forwardRef } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service'; // Nome corrigido
import { GameRepository } from './repositories/game.repository';
import { RecordsModule } from '../records/records.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => RecordsModule), //
  ],
  controllers: [GameController], //
  providers: [
    GameService, //
    {
      provide: 'IGameRepository',
      useClass: GameRepository,
    },
  ],
  exports: [GameService, 'IGameRepository'], //
})
export class GameModule { }