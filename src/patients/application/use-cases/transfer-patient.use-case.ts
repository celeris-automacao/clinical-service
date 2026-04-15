import { Inject, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { STAFF_REPOSITORY } from '../../../staff/staff.tokens';
import { StaffRepositoryPort } from '../../../staff/application/ports/staff-repository.port';
import { UserContext } from '../../../shared/auth/user-context';

@Injectable()
export class TransferPatientUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly patientsRepository: PatientsRepositoryPort,
    @Inject(STAFF_REPOSITORY)
    private readonly staffRepository: StaffRepositoryPort,
  ) {}

  async execute(patientId: string, newDoctorId: string, user: UserContext) {
    // Apenas donos da clínica ou admins podem transferir pacientes
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Apenas gestores podem transferir pacientes entre médicos.');
    }

    // Verifica se o paciente existe no tenant
    const patient = await this.patientsRepository.findById(patientId, user.tenantId);
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    // Verifica se o novo médico existe no tenant e é de fato um médico/especialista
    const staff = await this.staffRepository.findById(newDoctorId, user.tenantId);
    if (!staff) {
      throw new NotFoundException('Médico de destino não encontrado nesta clínica.');
    }

    // Atualiza o responsável pelo paciente
    return this.patientsRepository.update(patientId, user.tenantId, {
      responsibleStaffId: newDoctorId,
    });
  }
}
