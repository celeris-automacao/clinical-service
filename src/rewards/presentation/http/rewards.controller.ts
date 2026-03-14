import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../../../common/decorators/get-user.decorator';
import { ClaimRewardUseCase } from '../../application/use-cases/claim-reward.use-case';
import { GetAvailableRewardsUseCase } from '../../application/use-cases/get-available-rewards.use-case';

@Controller('rewards')
@UseGuards(SupabaseGuard)
export class RewardsController {
  constructor(
    private readonly getAvailableRewardsUseCase: GetAvailableRewardsUseCase,
    private readonly claimRewardUseCase: ClaimRewardUseCase,
  ) {}

  @Get()
  getAvailable(@GetUser() user: UserContext) {
    return this.getAvailableRewardsUseCase.execute(user);
  }

  @Post(':id/claim')
  claim(@Param('id') rewardId: string, @GetUser() user: UserContext) {
    return this.claimRewardUseCase.execute(rewardId, user);
  }
}
