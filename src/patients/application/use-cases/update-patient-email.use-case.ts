import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';

const STAFF_ROLES = ['owner', 'admin', 'doctor', 'specialist', 'staff'];

@Injectable()
export class UpdatePatientEmailUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
  ) {}

  async execute(patientId: string, email: string, user: UserContext) {
    const isSelf = user.role === 'patient' && user.userId === patientId;
    if (!isSelf && !STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException(
        'Sem permissao para alterar o e-mail do paciente.',
      );
    }

    const patient = await this.repository.findById(patientId, user.tenantId);
    if (!patient) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    const duplicate = await this.repository.findByEmail(
      email,
      user.tenantId,
      patientId,
    );
    if (duplicate) {
      throw new BadRequestException(
        'Este e-mail ja esta cadastrado para outro paciente nesta clinica.',
      );
    }

    return this.repository.updateEmail(patientId, user.tenantId, email);
  }
}
