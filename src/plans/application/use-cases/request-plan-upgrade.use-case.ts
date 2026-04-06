import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PLANS_REPOSITORY } from '../../plans.tokens';
import { PlansRepositoryPort } from '../ports/plans-repository.port';

@Injectable()
export class RequestPlanUpgradeUseCase {
  constructor(
    @Inject(PLANS_REPOSITORY)
    private readonly plansRepository: PlansRepositoryPort,
    private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory,
  ) {}

  async execute(tenantId: string, targetPlanId: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    const tenant = await prisma.tenant.findUnique({ 
      where: { id: tenantId },
      include: { plan: true }
    });
    if (!tenant) throw new NotFoundException('Clínica não encontrada.');
    const currentPlanId = tenant.planId;
    const currentPlan = tenant.plan;

    if (currentPlanId === targetPlanId) {
      throw new BadRequestException('O plano alvo deve ser diferente do plano atual.');
    }

    const pendingRequest = await this.plansRepository.findPendingUpgradeRequestByTenantId(tenantId);
    if (pendingRequest) {
      throw new BadRequestException('Você já possui uma solicitação de mudança pendente.');
    }

    const targetPlan = await this.plansRepository.findById(targetPlanId);
    if (!targetPlan || !targetPlan.isActive) {
      throw new NotFoundException('Plano alvo não encontrado ou inativo.');
    }

    if (Number(targetPlan.monthlyPrice) < Number(currentPlan.monthlyPrice)) {
      if (Number(targetPlan.monthlyPrice) === 0) {
        throw new BadRequestException('Não é permitido realizar downgrade para o plano Free.');
      }

      const patientCount = await prisma.patient.count({ where: { tenantId } });
      if (patientCount > targetPlan.maxPatients) {
        throw new BadRequestException(`Downgrade recusado: o plano ${targetPlan.name} permite até ${targetPlan.maxPatients} pacientes, mas sua clínica possui ${patientCount}. Reduza o uso antes de alterar o plano.`);
      }

      const staffCount = await prisma.staff.count({ where: { tenantId } });
      if (staffCount > targetPlan.maxStaff) {
        throw new BadRequestException(`Downgrade recusado: o plano ${targetPlan.name} permite até ${targetPlan.maxStaff} membros na equipe, mas sua clínica possui ${staffCount}. Reduza o uso antes de alterar o plano.`);
      }
    }

    return this.plansRepository.createUpgradeRequest({
      tenantId,
      currentPlanId,
      targetPlanId,
    });
  }
}
