import { Injectable } from '@nestjs/common';
import { UpdatePatientProfileDto } from '../../dto/update-patient-profile.dto';
import { GetPatientByIdUseCase } from './get-patient-by-id.use-case';
import { Inject } from '@nestjs/common';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';

@Injectable()
export class UpdatePatientProfileUseCase {
  constructor(
    private readonly getPatientByIdUseCase: GetPatientByIdUseCase,
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
  ) {}

  async execute(id: string, updateProfileDto: UpdatePatientProfileDto) {
    await this.getPatientByIdUseCase.execute(id);
    return this.repository.updateProfile(id, updateProfileDto);
  }
}
