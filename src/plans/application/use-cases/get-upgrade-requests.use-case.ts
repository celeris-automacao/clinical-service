import { Injectable, Inject } from '@nestjs/common';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class GetUpgradeRequestsUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly plansRepository: PlansRepositoryPort,
  ) {}

  async execute(status?: string) {
    return this.plansRepository.findUpgradeRequests(status);
  }
}
