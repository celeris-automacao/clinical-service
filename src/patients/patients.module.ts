import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePatientUseCase } from './application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from './application/use-cases/get-patient-by-id.use-case';
import { ListPatientsUseCase } from './application/use-cases/list-patients.use-case';
import { UpdatePatientProfileUseCase } from './application/use-cases/update-patient-profile.use-case';
import { PatientsController } from './presentation/http/patients.controller';
import { PrismaPatientsRepository } from './infrastructure/persistence/prisma-patients.repository';
import { PATIENTS_REPOSITORY } from './patients.tokens';

@Module({
  controllers: [PatientsController],
  providers: [
    RolesGuard,
    CreatePatientUseCase,
    GetPatientByIdUseCase,
    ListPatientsUseCase,
    UpdatePatientProfileUseCase,
    {
      provide: PATIENTS_REPOSITORY,
      useClass: PrismaPatientsRepository,
    },
  ],
})
export class PatientsModule {}
