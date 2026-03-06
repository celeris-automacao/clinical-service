// src/social/social.module.ts
import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { SocialListener } from './social.listener';
import { SocialRepository } from './repositories/social.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [SocialController],
  providers: [
    SocialService, 
    SocialListener,
    {
      provide: 'ISocialRepository',
      useClass: SocialRepository,
    },
  ],
  exports: [SocialService, 'ISocialRepository'],
})
export class SocialModule {}