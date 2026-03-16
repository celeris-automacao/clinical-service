import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class GetPlanByIdUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly repository: PlansRepositoryPort,
  ) {}

  async execute(id: string) {
    const plan = await this.repository.findById(id);

    if (!plan) {
      throw new NotFoundException('Plano nao encontrado.');
    }

    return plan;
  }
}
