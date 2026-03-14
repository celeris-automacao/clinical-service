import { Inject, Injectable } from '@nestjs/common';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
  ) {}

  async execute(createPatientDto: CreatePatientDto, tenantId: string) {
    return this.repository.createWithStats(createPatientDto, tenantId);
  }
}
