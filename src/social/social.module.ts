import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SocialController } from './social.controller';
import { SocialListener } from './social.listener';
import { CreateSocialPostUseCase } from './application/use-cases/create-social-post.use-case';
import { GetFeedUseCase } from './application/use-cases/get-feed.use-case';
import { SocialRepository } from './repositories/social.repository';
import { SOCIAL_REPOSITORY } from './social.tokens';

@Module({
  imports: [PrismaModule],
  controllers: [SocialController],
  providers: [
    GetFeedUseCase,
    CreateSocialPostUseCase,
    SocialListener,
    {
      provide: SOCIAL_REPOSITORY,
      useClass: SocialRepository,
    },
  ],
  exports: [GetFeedUseCase, CreateSocialPostUseCase, SOCIAL_REPOSITORY],
})
export class SocialModule {}
