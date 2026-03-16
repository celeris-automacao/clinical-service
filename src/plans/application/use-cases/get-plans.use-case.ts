import { Inject, Injectable } from '@nestjs/common';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class GetPlansUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly repository: PlansRepositoryPort,
  ) {}

  execute() {
    return this.repository.findAll();
  }
}
