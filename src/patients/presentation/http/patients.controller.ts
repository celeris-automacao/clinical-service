import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserContext } from '../../../shared/auth/user-context';
import { CreatePatientUseCase } from '../../application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from '../../application/use-cases/get-patient-by-id.use-case';
import { ListPatientsUseCase } from '../../application/use-cases/list-patients.use-case';
import { UpdatePatientProfileUseCase } from '../../application/use-cases/update-patient-profile.use-case';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ListPatientsDto } from './dto/list-patients.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@UseGuards(SupabaseGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly createPatientUseCase: CreatePatientUseCase,
    private readonly getPatientByIdUseCase: GetPatientByIdUseCase,
    private readonly listPatientsUseCase: ListPatientsUseCase,
    private readonly updatePatientProfileUseCase: UpdatePatientProfileUseCase,
  ) {}

  @Post()
  create(@Body() createPatientDto: CreatePatientDto, @GetUser() user: UserContext) {
    return this.createPatientUseCase.execute(createPatientDto, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'doctor', 'specialist', 'staff')
  @ApiOperation({ summary: 'Lista pacientes da clinica para visao medica' })
  findAll(@Query() filters: ListPatientsDto, @GetUser() user: UserContext) {
    return this.listPatientsUseCase.execute(user.tenantId, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: UserContext) {
    return this.getPatientByIdUseCase.execute(id, user.tenantId);
  }

  @Post(':id/profile')
  @ApiOperation({ summary: 'Realizar o intake clinico (objetivos e queixas)' })
  updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdatePatientProfileDto,
    @GetUser() user: UserContext,
  ) {
    return this.updatePatientProfileUseCase.execute(id, user.tenantId, updateProfileDto);
  }
}

