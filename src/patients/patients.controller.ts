import { Controller, Post, Body, Get, Param, Headers } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

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
}