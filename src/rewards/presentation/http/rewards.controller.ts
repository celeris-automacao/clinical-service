import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserContext } from '../../../shared/auth/user-context';
import { ClaimRewardUseCase } from '../../application/use-cases/claim-reward.use-case';
import { CreateRewardUseCase } from '../../application/use-cases/create-reward.use-case';
import { GetAvailableRewardsUseCase } from '../../application/use-cases/get-available-rewards.use-case';
import { CreateRewardDto } from './dto/create-reward.dto';

@Controller('rewards')
@UseGuards(SupabaseGuard)
export class RewardsController {
  constructor(
    private readonly createRewardUseCase: CreateRewardUseCase,
    private readonly getAvailableRewardsUseCase: GetAvailableRewardsUseCase,
    private readonly claimRewardUseCase: ClaimRewardUseCase,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  create(@Body() dto: CreateRewardDto, @GetUser() user: UserContext) {
    return this.createRewardUseCase.execute(dto, user.tenantId);
  }

  @Get()
  getAvailable(@GetUser() user: UserContext) {
    return this.getAvailableRewardsUseCase.execute(user);
  }

  @Post(':id/claim')
  claim(@Param('id') rewardId: string, @GetUser() user: UserContext) {
    return this.claimRewardUseCase.execute(rewardId, user);
  }
}
