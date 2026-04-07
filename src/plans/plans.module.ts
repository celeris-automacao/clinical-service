import { Module } from '@nestjs/common';
import { CreatePlanUseCase } from './application/use-cases/create-plan.use-case';
import { GetPlanByIdUseCase } from './application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from './application/use-cases/get-plans.use-case';
import { RequestPlanUpgradeUseCase } from './application/use-cases/request-plan-upgrade.use-case';
import { ResolveUpgradeRequestUseCase } from './application/use-cases/resolve-upgrade-request.use-case';
import { GetPendingUpgradeRequestUseCase } from './application/use-cases/get-pending-upgrade-request.use-case';
import { GetUpgradeRequestsUseCase } from './application/use-cases/get-upgrade-requests.use-case';
import { PrismaPlansRepository } from './infrastructure/persistence/prisma-plans.repository';
import { PlansController } from './presentation/http/plans.controller';
import { PLANS_REPOSITORY } from './plans.tokens';

@Module({
  controllers: [PlansController],
  providers: [
    CreatePlanUseCase,
    GetPlansUseCase,
    GetPlanByIdUseCase,
    RequestPlanUpgradeUseCase,
    ResolveUpgradeRequestUseCase,
    GetPendingUpgradeRequestUseCase,
    GetUpgradeRequestsUseCase,
    {
      provide: PLANS_REPOSITORY,
      useClass: PrismaPlansRepository,
    },
  ],
})
export class PlansModule {}
