// src/app.module.ts
import { Module } from '@nestjs/common';
import { RecordsModule } from './records/records.module';
import { TasksModule } from './tasks/tasks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GameModule } from './game/game.module';
import { AuthModule } from './auth/auth.module';
import { SocialModule } from './social/social.module';
import { TenantsModule } from './tenants/tenants.module';
import { PatientsModule } from './patients/patients.module';
import { SharedInfrastructureModule } from './shared/infrastructure/shared-infrastructure.module';

@Module({
  imports: [
    SharedInfrastructureModule,
    AuthModule,
    RecordsModule,
    TasksModule,
    DashboardModule,
    GameModule,
    SocialModule,
    TenantsModule,
    PatientsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
