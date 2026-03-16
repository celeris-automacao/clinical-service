import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreatePlanDto } from '../../presentation/http/dto/create-plan.dto';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class CreatePlanUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly repository: PlansRepositoryPort,
  ) {}

  async execute(dto: CreatePlanDto) {
    const existing = await this.repository.findByCode(dto.code);

    if (existing) {
      throw new BadRequestException('Ja existe um plano com este codigo.');
    }

    return this.repository.create(dto);
  }
}
