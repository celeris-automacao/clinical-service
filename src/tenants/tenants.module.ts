import { Module } from '@nestjs/common';
import { ChangeTenantStatusUseCase } from './application/use-cases/change-tenant-status.use-case';
import { CreateTenantUseCase } from './application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from './application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from './application/use-cases/get-tenants.use-case';
import { PrismaTenantsRepository } from './infrastructure/persistence/prisma-tenants.repository';
import { TenantsController } from './presentation/http/tenants.controller';
import { TENANTS_REPOSITORY } from './tenants.tokens';

@Module({
  controllers: [TenantsController],
  providers: [
    CreateTenantUseCase,
    GetTenantsUseCase,
    GetTenantByIdUseCase,
    ChangeTenantStatusUseCase,
    {
      provide: TENANTS_REPOSITORY,
      useClass: PrismaTenantsRepository,
    },
  ],
})
export class TenantsModule {}
