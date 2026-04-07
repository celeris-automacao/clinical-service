import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class ResolveUpgradeRequestUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly plansRepository: PlansRepositoryPort,
    private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory,
  ) {}

  async execute(id: string, action: 'approve' | 'reject', resolvedBy: string) {
    const request = await this.plansRepository.findUpgradeRequestById(id);
    
    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Esta solicitação já foi processada.');
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    // Atualiza o status da requisição
    const updatedRequest = await this.plansRepository.updateUpgradeRequestStatus(
      id,
      newStatus,
      resolvedBy
    );

    if (action === 'approve') {
      const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
      await prisma.tenant.update({
        where: { id: request.tenantId },
        data: { planId: request.targetPlanId },
      });
    }
    
    return updatedRequest;
  }
}
