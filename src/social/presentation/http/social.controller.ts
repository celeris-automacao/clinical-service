import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../../../common/decorators/get-user.decorator';
import { GetFeedUseCase } from '../../application/use-cases/get-feed.use-case';

@Controller('social')
@UseGuards(SupabaseGuard)
export class SocialController {
  constructor(private readonly getFeedUseCase: GetFeedUseCase) {}

  @Get('feed')
  async getFeed(@GetUser() user: UserContext) {
    return this.getFeedUseCase.execute(user.tenantId);
  }
}
