import { Inject, Injectable } from '@nestjs/common';
import { UpdatePatientProfileDto } from '../../presentation/http/dto/update-patient-profile.dto';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';
import { GetPatientByIdUseCase } from './get-patient-by-id.use-case';

@Injectable()
export class UpdatePatientProfileUseCase {
  constructor(
    private readonly getPatientByIdUseCase: GetPatientByIdUseCase,
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
  ) {}

  async execute(id: string, tenantId: string, updateProfileDto: UpdatePatientProfileDto) {
    await this.getPatientByIdUseCase.execute(id, tenantId);
    return this.repository.updateProfile(id, tenantId, updateProfileDto);
  }
}
