import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { APPLICATION_EVENT_BUS, TENANT_PLAN_PORT } from '../shared.tokens';
import { NestApplicationEventBusAdapter } from './events/nest-application-event-bus.adapter';
import { PrismaTenantPlanAdapter } from './persistence/prisma-tenant-plan.adapter';
import { TenantScopedPrismaFactory } from './persistence/tenant-scoped-prisma.factory';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot(), PrismaModule],
  providers: [
    TenantScopedPrismaFactory,
    NestApplicationEventBusAdapter,
    {
      provide: APPLICATION_EVENT_BUS,
      useExisting: NestApplicationEventBusAdapter,
    },
    {
      provide: TENANT_PLAN_PORT,
      useClass: PrismaTenantPlanAdapter,
    },
  ],
  exports: [PrismaModule, APPLICATION_EVENT_BUS, TENANT_PLAN_PORT, TenantScopedPrismaFactory],
})
export class SharedInfrastructureModule {}
