import { Module } from '@nestjs/common';
import { CreateTenantUseCase } from './application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from './application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from './application/use-cases/get-tenants.use-case';
import { TenantsController } from './presentation/http/tenants.controller';
import { TenantsRepository } from './infrastructure/persistence/prisma-tenants.repository';
import { TENANTS_REPOSITORY } from './tenants.tokens';

@Module({
  controllers: [TenantsController],
  providers: [
    CreateTenantUseCase,
    GetTenantsUseCase,
    GetTenantByIdUseCase,
    {
      provide: TENANTS_REPOSITORY,
      useClass: TenantsRepository,
    },
  ],
  exports: [CreateTenantUseCase, GetTenantsUseCase, GetTenantByIdUseCase, TENANTS_REPOSITORY],
})
export class TenantsModule {}
