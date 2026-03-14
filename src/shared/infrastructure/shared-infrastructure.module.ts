import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { APPLICATION_EVENT_BUS } from '../shared.tokens';
import { NestApplicationEventBusAdapter } from './events/nest-application-event-bus.adapter';
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
  ],
  exports: [PrismaModule, APPLICATION_EVENT_BUS, TenantScopedPrismaFactory],
})
export class SharedInfrastructureModule {}
