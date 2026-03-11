import { Controller, Get, UseGuards } from '@nestjs/common';
import { GameService } from './game.service'; // Nome corrigido
import { SupabaseGuard } from '../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../common/decorators/get-user.decorator';

@Controller('player')
@UseGuards(SupabaseGuard)
export class GameController {
  constructor(private readonly gameService: GameService) {} // Injeção atualizada

  @Get('stats')
  async getStats(@GetUser() user: UserContext) {
    return this.gameService.getPlayerStats(user);
  }
}