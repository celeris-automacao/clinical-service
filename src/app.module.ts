// src/app.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { RecordsModule } from './records/records.module';
import { TasksModule } from './tasks/tasks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GameModule } from './game/game.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { SocialModule } from './social/social.module';

@Module({
  imports: [
    AuthModule,
    EventEmitterModule.forRoot(),
    PrismaModule, 
    RecordsModule, 
    TasksModule,
    DashboardModule,
    GameModule,
    SocialModule

  ],
  controllers: [],
  providers: [],
})
export class AppModule {}