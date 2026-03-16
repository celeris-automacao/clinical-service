import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { UserContext } from '../../../shared/auth/user-context';
import { GetPlayerStatsUseCase } from '../../application/use-cases/get-player-stats.use-case';

@Controller('player')
@UseGuards(SupabaseGuard)
export class GameController {
  constructor(private readonly getPlayerStatsUseCase: GetPlayerStatsUseCase) {}

  @Get('stats')
  async getStats(@GetUser() user: UserContext) {
    return this.getPlayerStatsUseCase.execute(user);
  }
}
