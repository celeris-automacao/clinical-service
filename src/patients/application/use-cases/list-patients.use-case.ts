import { Inject, Injectable } from '@nestjs/common';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { STAFF_REPOSITORY } from '../../../staff/staff.tokens';
import { StaffRepositoryPort } from '../../../staff/application/ports/staff-repository.port';
import { UserContext } from '../../../shared/auth/user-context';

@Injectable()
export class ListPatientsUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly patientsRepository: PatientsRepositoryPort,
    @Inject(STAFF_REPOSITORY)
    private readonly staffRepository: StaffRepositoryPort,
  ) {}

  async execute(user: UserContext) {
    const filters: { responsibleStaffId?: string } = {};

    // Se for médico ou especialista, filtra apenas pelos pacientes dele
    if (user.role === 'doctor' || user.role === 'specialist') {
      const staff = await this.staffRepository.findByUserId(user.userId, user.tenantId);
      if (staff) {
        filters.responsibleStaffId = staff.id;
      } else {
        // Se não encontrar o staff, retorna lista vazia para segurança
        return [];
      }
    }

    return this.patientsRepository.findAll(user.tenantId, filters);
  }
}
