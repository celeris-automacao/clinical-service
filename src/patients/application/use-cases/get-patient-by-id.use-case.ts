import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';

@Injectable()
export class GetPatientByIdUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
  ) {}

  async execute(id: string) {
    const patient = await this.repository.findById(id);
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    return patient;
  }
}
