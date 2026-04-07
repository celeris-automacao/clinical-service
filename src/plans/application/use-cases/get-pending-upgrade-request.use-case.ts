import { Injectable, Inject } from '@nestjs/common';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class GetPendingUpgradeRequestUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly plansRepository: PlansRepositoryPort,
  ) {}

  async execute(tenantId: string) {
    return this.plansRepository.findPendingUpgradeRequestByTenantId(tenantId);
  }
}
