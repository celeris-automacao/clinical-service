import { Module } from '@nestjs/common';
import { CreatePlanUseCase } from './application/use-cases/create-plan.use-case';
import { GetPlanByIdUseCase } from './application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from './application/use-cases/get-plans.use-case';
import { PrismaPlansRepository } from './infrastructure/persistence/prisma-plans.repository';
import { PlansController } from './presentation/http/plans.controller';
import { PLANS_REPOSITORY } from './plans.tokens';

@Module({
  controllers: [PlansController],
  providers: [
    CreatePlanUseCase,
    GetPlansUseCase,
    GetPlanByIdUseCase,
    {
      provide: PLANS_REPOSITORY,
      useClass: PrismaPlansRepository,
    },
  ],
})
export class PlansModule {}
