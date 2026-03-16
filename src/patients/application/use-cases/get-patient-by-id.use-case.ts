import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';

@Injectable()
export class GetPatientByIdUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
  ) {}

  async execute(id: string, tenantId: string) {
    const patient = await this.repository.findById(id, tenantId);
    if (!patient) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    return patient;
  }
}
