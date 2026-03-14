import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../../../common/decorators/get-user.decorator';
import { CreateClinicalRecordUseCase } from '../../application/use-cases/create-clinical-record.use-case';
import { GetPatientEvolutionUseCase } from '../../application/use-cases/get-patient-evolution.use-case';
import { GetPatientStatsUseCase } from '../../application/use-cases/get-patient-stats.use-case';
import { CreateRecordDto } from './dto/create-record.dto';
import { EvolutionDto } from './dto/evolution.dto';

@Controller('records')
@UseGuards(SupabaseGuard)
export class RecordsController {
  constructor(
    private readonly createClinicalRecordUseCase: CreateClinicalRecordUseCase,
    private readonly getPatientEvolutionUseCase: GetPatientEvolutionUseCase,
    private readonly getPatientStatsUseCase: GetPatientStatsUseCase,
  ) {}

  @Post()
  createRecord(@Body() createRecordDto: CreateRecordDto, @GetUser() user: UserContext) {
    return this.createClinicalRecordUseCase.execute(createRecordDto, user);
  }

  @Get('me')
  @UseGuards(SupabaseGuard)
  @ApiOperation({ summary: 'Busca histórico de evolução' })
  @ApiResponse({ status: 200, type: [EvolutionDto] })
  getEvolution(@GetUser() user: UserContext) {
    return this.getPatientEvolutionUseCase.execute(user);
  }

  @Get('stats')
  @UseGuards(SupabaseGuard)
  getStats(@GetUser() user: UserContext) {
    return this.getPatientStatsUseCase.execute(user);
  }
}
