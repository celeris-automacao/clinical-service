import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { TenantPlanPort } from '../../../shared/application/ports/tenant-plan.port';
import { TENANT_PLAN_PORT } from '../../../shared/shared.tokens';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
    @Inject(TENANT_PLAN_PORT)
    private readonly tenantPlanPort: TenantPlanPort,
  ) {}

  async execute(createPatientDto: CreatePatientDto, tenantId: string) {
    const [plan, currentPatients] = await Promise.all([
      this.tenantPlanPort.getTenantPlan(tenantId),
      this.repository.countByTenant(tenantId),
    ]);

    if (!plan) {
      throw new BadRequestException('Clinica sem plano ativo.');
    }

    if (currentPatients >= plan.maxPatients) {
      throw new BadRequestException('Limite de pacientes do plano atingido.');
    }

    return this.repository.createWithStats(createPatientDto, tenantId);
  }
}
