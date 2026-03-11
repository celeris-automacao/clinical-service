//src/game/rewards.controller.ts
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { SupabaseGuard } from '../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../common/decorators/get-user.decorator';

@Controller('rewards')
@UseGuards(SupabaseGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get() // Lista todas as recompensas e o progresso do paciente
  getAvailable(@GetUser() user: UserContext) {
    return this.rewardsService.getAvailableRewards(user);
  }

  @Post(':id/claim') // Realiza o resgate de um prêmio ou medalha
  claim(
    @Param('id') rewardId: string,
    @GetUser() user: UserContext
  ) {
    return this.rewardsService.claimReward(rewardId, user);
  }
}