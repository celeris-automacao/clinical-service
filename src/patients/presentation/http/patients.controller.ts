import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CreatePatientUseCase } from '../../application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from '../../application/use-cases/get-patient-by-id.use-case';
import { UpdatePatientProfileUseCase } from '../../application/use-cases/update-patient-profile.use-case';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@Controller('patients')
export class PatientsController {
  constructor(
    private readonly createPatientUseCase: CreatePatientUseCase,
    private readonly getPatientByIdUseCase: GetPatientByIdUseCase,
    private readonly updatePatientProfileUseCase: UpdatePatientProfileUseCase,
  ) {}

  @Post()
  create(
    @Body() createPatientDto: CreatePatientDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.createPatientUseCase.execute(createPatientDto, tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getPatientByIdUseCase.execute(id);
  }

  @Post(':id/profile')
  @ApiOperation({ summary: 'Realizar o intake clínico (objetivos e queixas)' })
  updateProfile(@Param('id') id: string, @Body() updateProfileDto: UpdatePatientProfileDto) {
    return this.updatePatientProfileUseCase.execute(id, updateProfileDto);
  }
}
