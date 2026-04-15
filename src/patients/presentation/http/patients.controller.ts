import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { UserContext } from '../../../shared/auth/user-context';
import { CreatePatientUseCase } from '../../application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from '../../application/use-cases/get-patient-by-id.use-case';
import { UpdatePatientProfileUseCase } from '../../application/use-cases/update-patient-profile.use-case';
import { ListPatientsUseCase } from '../../application/use-cases/list-patients.use-case';
import { TransferPatientUseCase } from '../../application/use-cases/transfer-patient.use-case';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { TransferPatientDto } from './dto/transfer-patient.dto';

@ApiTags('Patients')
@UseGuards(SupabaseGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly createPatientUseCase: CreatePatientUseCase,
    private readonly getPatientByIdUseCase: GetPatientByIdUseCase,
    private readonly updatePatientProfileUseCase: UpdatePatientProfileUseCase,
    private readonly listPatientsUseCase: ListPatientsUseCase,
    private readonly transferPatientUseCase: TransferPatientUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar um novo paciente' })
  create(@Body() createPatientDto: CreatePatientDto, @GetUser() user: UserContext) {
    return this.createPatientUseCase.execute(createPatientDto, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pacientes (filtrado por médico se necessário)' })
  findAll(@GetUser() user: UserContext) {
    return this.listPatientsUseCase.execute(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de um paciente' })
  findOne(@Param('id') id: string, @GetUser() user: UserContext) {
    return this.getPatientByIdUseCase.execute(id, user.tenantId);
  }

  @Patch(':id/transfer')
  @ApiOperation({ summary: 'Transferir paciente para outro médico (Dono/Admin)' })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferPatientDto,
    @GetUser() user: UserContext,
  ) {
    return this.transferPatientUseCase.execute(id, dto.newDoctorId, user);
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
