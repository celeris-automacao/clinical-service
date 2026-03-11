import { Controller, Post, Body, Get, Param, Headers } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) { }

  @Post()
  create(
    @Body() createPatientDto: CreatePatientDto,
    @Headers('x-tenant-id') tenantId: string
  ) {
    return this.patientsService.create(createPatientDto, tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Post(':id/profile')
  @ApiOperation({ summary: 'Realizar o intake clínico (objetivos e queixas)' })
  updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdatePatientProfileDto
  ) {
    return this.patientsService.updateProfile(id, updateProfileDto);
  }
}