import { Module } from '@nestjs/common';
import { TenantsRepository } from './repositories/tenants.repository';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';

@Module({
  controllers: [TenantsController],
  providers: [
    TenantsService,
    {
      provide: 'ITenantsRepository',
      useClass: TenantsRepository,
    },
  ],
  exports: [TenantsService], // Exportamos para que outros módulos (como o de Patients) possam usá-lo
})
export class TenantsModule {}