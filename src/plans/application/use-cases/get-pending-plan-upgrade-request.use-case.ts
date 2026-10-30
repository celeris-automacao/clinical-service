import { Inject, Injectable } from '@nestjs/common';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class GetPendingPlanUpgradeRequestUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly repository: PlansRepositoryPort,
  ) {}

  execute(tenantId: string) {
    return this.repository.findPendingUpgradeRequest(tenantId);
  }
}
