import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserContext } from '../../../shared/auth/user-context';
import { CreateClinicalRecordUseCase } from '../../application/use-cases/create-clinical-record.use-case';
import { CreateClinicalNoteUseCase } from '../../application/use-cases/create-clinical-note.use-case';
import { GetPatientEvolutionUseCase } from '../../application/use-cases/get-patient-evolution.use-case';
import { GetPatientClinicalNotesUseCase } from '../../application/use-cases/get-patient-clinical-notes.use-case';
import { GetPatientStatsUseCase } from '../../application/use-cases/get-patient-stats.use-case';
import { GetPatientRecordsForDoctorUseCase } from '../../application/use-cases/get-patient-records-for-doctor.use-case';
import { UpdateClinicalNoteUseCase } from '../../application/use-cases/update-clinical-note.use-case';
import { UpdateLastRecordUseCase } from '../../application/use-cases/update-last-record.use-case';
import { CreateClinicalNoteDto } from './dto/create-clinical-note.dto';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateClinicalNoteDto } from './dto/update-clinical-note.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { EvolutionDto } from './dto/evolution.dto';

@Controller('records')
@UseGuards(SupabaseGuard)
export class RecordsController {
  constructor(
    private readonly createClinicalRecordUseCase: CreateClinicalRecordUseCase,
    private readonly createClinicalNoteUseCase: CreateClinicalNoteUseCase,
    private readonly getPatientEvolutionUseCase: GetPatientEvolutionUseCase,
    private readonly getPatientClinicalNotesUseCase: GetPatientClinicalNotesUseCase,
    private readonly getPatientStatsUseCase: GetPatientStatsUseCase,
    private readonly getPatientRecordsForDoctorUseCase: GetPatientRecordsForDoctorUseCase,
    private readonly updateLastRecordUseCase: UpdateLastRecordUseCase,
    private readonly updateClinicalNoteUseCase: UpdateClinicalNoteUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo registro clinico (self ou em nome de paciente)' })
  createRecord(@Body() createRecordDto: CreateRecordDto, @GetUser() user: UserContext) {
    return this.createClinicalRecordUseCase.execute(createRecordDto, user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Busca historico de evolucao do proprio paciente' })
  @ApiResponse({ status: 200, type: [EvolutionDto] })
  getEvolution(@GetUser() user: UserContext) {
    return this.getPatientEvolutionUseCase.execute(user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Retorna estatisticas clinicas do proprio paciente' })
  getStats(@GetUser() user: UserContext) {
    return this.getPatientStatsUseCase.execute(user);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Medico consulta historico biometrico de um paciente' })
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'doctor', 'specialist', 'staff')
  getPatientRecords(@Param('patientId') patientId: string, @GetUser() user: UserContext) {
    return this.getPatientRecordsForDoctorUseCase.execute(patientId, user);
  }

  @Patch(':recordId/patient/:patientId')
  @ApiOperation({ summary: 'Edita apenas o ultimo registro de um paciente' })
  updateLastRecord(
    @Param('recordId') recordId: string,
    @Param('patientId') patientId: string,
    @GetUser() user: UserContext,
    @Body() dto: UpdateRecordDto,
  ) {
    return this.updateLastRecordUseCase.execute(recordId, patientId, user, dto);
  }

  @Post('clinical-notes')
  @ApiOperation({ summary: 'Profissional registra evolucao/anamnese de paciente' })
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'doctor', 'specialist', 'staff')
  createClinicalNote(@Body() dto: CreateClinicalNoteDto, @GetUser() user: UserContext) {
    return this.createClinicalNoteUseCase.execute(dto, user);
  }

  @Get('clinical-notes/patient/:patientId')
  @ApiOperation({ summary: 'Lista evolucoes clinicas do paciente para profissionais' })
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'doctor', 'specialist', 'staff')
  getPatientClinicalNotes(@Param('patientId') patientId: string, @GetUser() user: UserContext) {
    return this.getPatientClinicalNotesUseCase.execute(patientId, user);
  }

  @Patch('clinical-notes/:noteId')
  @ApiOperation({ summary: 'Atualiza evolucao clinica existente' })
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'doctor', 'specialist', 'staff')
  updateClinicalNote(
    @Param('noteId') noteId: string,
    @Body() dto: UpdateClinicalNoteDto,
    @GetUser() user: UserContext,
  ) {
    return this.updateClinicalNoteUseCase.execute(noteId, dto, user);
  }
}

