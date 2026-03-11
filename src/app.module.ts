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
// NOVOS IMPORTES
import { TenantsModule } from './tenants/tenants.module';
import { PatientsModule } from './patients/patients.module';

@Module({
  imports: [
    AuthModule,
    EventEmitterModule.forRoot(),
    PrismaModule,
    RecordsModule,
    TasksModule,
    DashboardModule,
    GameModule,
    SocialModule,
    TenantsModule,
    PatientsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}