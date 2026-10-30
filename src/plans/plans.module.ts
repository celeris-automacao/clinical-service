import { Module } from '@nestjs/common';
import { SupabaseGuard } from '../auth/guards/supabase.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePlanUseCase } from './application/use-cases/create-plan.use-case';
import { CreatePlanUpgradeRequestUseCase } from './application/use-cases/create-plan-upgrade-request.use-case';
import { GetPendingPlanUpgradeRequestUseCase } from './application/use-cases/get-pending-plan-upgrade-request.use-case';
import { GetPlanByIdUseCase } from './application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from './application/use-cases/get-plans.use-case';
import { PrismaPlansRepository } from './infrastructure/persistence/prisma-plans.repository';
import { PlansController } from './presentation/http/plans.controller';
import { PLANS_REPOSITORY } from './plans.tokens';

@Module({
  controllers: [PlansController],
  providers: [
    SupabaseGuard,
    RolesGuard,
    CreatePlanUseCase,
    CreatePlanUpgradeRequestUseCase,
    GetPendingPlanUpgradeRequestUseCase,
    GetPlansUseCase,
    GetPlanByIdUseCase,
    {
      provide: PLANS_REPOSITORY,
      useClass: PrismaPlansRepository,
    },
  ],
})
export class PlansModule {}
