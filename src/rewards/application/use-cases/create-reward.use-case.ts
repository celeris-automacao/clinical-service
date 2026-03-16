import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateRewardDto } from '../../presentation/http/dto/create-reward.dto';
import { REWARDS_REPOSITORY } from '../../rewards.tokens';
import { RewardsRepositoryPort } from '../ports/rewards-repository.port';

@Injectable()
export class CreateRewardUseCase {
  constructor(
    @Inject(REWARDS_REPOSITORY)
    private readonly repository: RewardsRepositoryPort,
  ) {}

  async execute(dto: CreateRewardDto, tenantId: string) {
    const existingReward = await this.repository.findByTitle(dto.title, tenantId);

    if (existingReward) {
      throw new BadRequestException('Ja existe uma recompensa com este titulo nesta clinica.');
    }

    return this.repository.create({
      ...dto,
      tenantId,
      isActive: dto.isActive ?? true,
    });
  }
}
