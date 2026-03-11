import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { PatientsRepository } from './repositories/patients.repository';

@Module({
  controllers: [PatientsController],
  providers: [
    PatientsService,
    {
      provide: 'IPatientsRepository',
      useClass: PatientsRepository,
    },
  ],
  exports: [PatientsService],
})
export class PatientsModule {}