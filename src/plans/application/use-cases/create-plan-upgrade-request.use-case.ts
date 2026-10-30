import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class CreatePlanUpgradeRequestUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly repository: PlansRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    requestedByUserId: string,
    targetPlanId: string,
  ) {
    const existingRequest =
      await this.repository.findPendingUpgradeRequest(tenantId);
    if (existingRequest) {
      throw new BadRequestException(
        'A clinica ja possui uma solicitacao de plano pendente.',
      );
    }

    const currentPlanId =
      await this.repository.findTenantCurrentPlanId(tenantId);
    if (!currentPlanId) {
      throw new BadRequestException(
        'Nao foi possivel identificar o plano atual da clinica.',
      );
    }
    if (targetPlanId === currentPlanId) {
      throw new BadRequestException(
        'A clinica ja utiliza este plano.',
      );
    }

    const targetPlan = await this.repository.findById(targetPlanId);
    if (!targetPlan || !targetPlan.isActive) {
      throw new BadRequestException('O plano selecionado nao esta disponivel.');
    }

    return this.repository.createUpgradeRequest({
      tenantId,
      currentPlanId,
      targetPlanId,
      requestedByUserId,
    });
  }
}
