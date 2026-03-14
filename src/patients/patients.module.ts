import { Module } from '@nestjs/common';
import { CreatePatientUseCase } from './application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from './application/use-cases/get-patient-by-id.use-case';
import { UpdatePatientProfileUseCase } from './application/use-cases/update-patient-profile.use-case';
import { PatientsController } from './presentation/http/patients.controller';
import { PatientsRepository } from './infrastructure/persistence/prisma-patients.repository';
import { PATIENTS_REPOSITORY } from './patients.tokens';

@Module({
  controllers: [PatientsController],
  providers: [
    CreatePatientUseCase,
    GetPatientByIdUseCase,
    UpdatePatientProfileUseCase,
    {
      provide: PATIENTS_REPOSITORY,
      useClass: PatientsRepository,
    },
  ],
  exports: [CreatePatientUseCase, GetPatientByIdUseCase, UpdatePatientProfileUseCase, PATIENTS_REPOSITORY],
})
export class PatientsModule {}
