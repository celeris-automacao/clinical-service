import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { UserContext } from '../../../shared/auth/user-context';
import { CreateClinicalRecordUseCase } from '../../application/use-cases/create-clinical-record.use-case';
import { GetPatientEvolutionUseCase } from '../../application/use-cases/get-patient-evolution.use-case';
import { GetPatientStatsUseCase } from '../../application/use-cases/get-patient-stats.use-case';
import { GetPatientRecordsForDoctorUseCase } from '../../application/use-cases/get-patient-records-for-doctor.use-case';
import { UpdateLastRecordUseCase } from '../../application/use-cases/update-last-record.use-case';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { EvolutionDto } from './dto/evolution.dto';

@Controller('records')
@UseGuards(SupabaseGuard)
export class RecordsController {
  constructor(
    private readonly createClinicalRecordUseCase: CreateClinicalRecordUseCase,
    private readonly getPatientEvolutionUseCase: GetPatientEvolutionUseCase,
    private readonly getPatientStatsUseCase: GetPatientStatsUseCase,
    private readonly getPatientRecordsForDoctorUseCase: GetPatientRecordsForDoctorUseCase,
    private readonly updateLastRecordUseCase: UpdateLastRecordUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo registro clínico (self ou em nome de paciente)' })
  createRecord(@Body() createRecordDto: CreateRecordDto, @GetUser() user: UserContext) {
    return this.createClinicalRecordUseCase.execute(createRecordDto, user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Busca histórico de evolução do próprio paciente' })
  @ApiResponse({ status: 200, type: [EvolutionDto] })
  getEvolution(@GetUser() user: UserContext) {
    return this.getPatientEvolutionUseCase.execute(user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Retorna estatísticas clínicas do próprio paciente' })
  getStats(@GetUser() user: UserContext) {
    return this.getPatientStatsUseCase.execute(user);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Médico consulta histórico biométrico de um paciente' })
  getPatientRecords(@Param('patientId') patientId: string, @GetUser() user: UserContext) {
    return this.getPatientRecordsForDoctorUseCase.execute(patientId, user);
  }

  @Patch(':recordId/patient/:patientId')
  @ApiOperation({ summary: 'Edita apenas o último registro de um paciente' })
  updateLastRecord(
    @Param('recordId') recordId: string,
    @Param('patientId') patientId: string,
    @GetUser() user: UserContext,
    @Body() dto: UpdateRecordDto,
  ) {
    return this.updateLastRecordUseCase.execute(recordId, patientId, user, dto);
  }
}
