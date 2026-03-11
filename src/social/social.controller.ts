// src/social/social.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { SocialService } from './social.service';
import { SupabaseGuard } from '../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../common/decorators/get-user.decorator';

@Controller('social')
@UseGuards(SupabaseGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('feed')
  async getFeed(@GetUser() user: UserContext) {
    // Filtra automaticamente pelo tenantId do usuário logado
    return this.socialService.getFeed(user.tenantId);
  }
}