import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CreateSocialPostUseCase } from './application/use-cases/create-social-post.use-case';
import { GetFeedUseCase } from './application/use-cases/get-feed.use-case';
import { SocialController } from './presentation/http/social.controller';
import { SocialListener } from './presentation/listeners/social.listener';
import { PrismaSocialRepository } from './infrastructure/persistence/prisma-social.repository';
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
      useClass: PrismaSocialRepository,
    },
  ],
  exports: [GetFeedUseCase, CreateSocialPostUseCase, SOCIAL_REPOSITORY],
})
export class SocialModule {}
