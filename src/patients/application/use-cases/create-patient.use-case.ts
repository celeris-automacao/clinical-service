import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { TenantPlanPort } from '../../../shared/application/ports/tenant-plan.port';
import { TENANT_PLAN_PORT } from '../../../shared/shared.tokens';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';
import { UserContext } from '../../../shared/auth/user-context';
import {
  isValidCpf,
  normalizeCpf,
} from '../../../common/validation/cpf.validator';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
    @Inject(TENANT_PLAN_PORT)
    private readonly tenantPlanPort: TenantPlanPort,
  ) {}

  async execute(createPatientDto: CreatePatientDto, user: UserContext) {
    const mayCreatePatient = [
      'owner',
      'admin',
      'doctor',
      'specialist',
      'staff',
    ].includes(user.role);
    const mayCreateSelf =
      user.role === 'patient' && createPatientDto.supabaseId === user.userId;
    if (!mayCreatePatient && !mayCreateSelf) {
      throw new ForbiddenException(
        'Sem permissao para cadastrar pacientes nesta clinica.',
      );
    }

    if (
      !createPatientDto.name?.trim() ||
      !createPatientDto.email?.trim() ||
      !createPatientDto.phone?.trim() ||
      !createPatientDto.document
    ) {
      throw new BadRequestException(
        'Nome, e-mail, telefone e CPF sao obrigatorios.',
      );
    }

    createPatientDto.name = createPatientDto.name.trim();
    createPatientDto.email = createPatientDto.email.trim().toLowerCase();
    createPatientDto.document = normalizeCpf(createPatientDto.document);
    createPatientDto.phone = createPatientDto.phone.replace(/\D/g, '');
    if (!isValidCpf(createPatientDto.document)) {
      throw new BadRequestException('Informe um CPF valido.');
    }
    if (!/^\+?\d{10,13}$/.test(createPatientDto.phone)) {
      throw new BadRequestException('Informe um telefone valido.');
    }
    const existingDocument = await this.repository.findByDocument(
      createPatientDto.document,
      user.tenantId,
    );
    if (existingDocument) {
      throw new BadRequestException(
        'Ja existe um paciente com este CPF nesta clinica.',
      );
    }
    if (
      createPatientDto.birthDate &&
      !isValidPastOrTodayDate(createPatientDto.birthDate)
    ) {
      throw new BadRequestException('Informe uma data de nascimento valida.');
    }

    const tenantId = user.tenantId;
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

    if (mayCreateSelf && !createPatientDto.supabaseId) {
      createPatientDto.supabaseId = user.userId;
    }

    if (!createPatientDto.assignedStaffId && user.staffId) {
      createPatientDto.assignedStaffId = user.staffId;
    }

    return this.repository.createWithStats(
      createPatientDto,
      tenantId,
      user.userId,
    );
  }
}

function isValidPastOrTodayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  return value <= new Date().toISOString().slice(0, 10);
}
