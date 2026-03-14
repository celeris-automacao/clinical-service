import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { UserContext } from '../../../shared/auth/user-context';
import { CreatePatientUseCase } from '../../application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from '../../application/use-cases/get-patient-by-id.use-case';
import { UpdatePatientProfileUseCase } from '../../application/use-cases/update-patient-profile.use-case';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@UseGuards(SupabaseGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly createPatientUseCase: CreatePatientUseCase,
    private readonly getPatientByIdUseCase: GetPatientByIdUseCase,
    private readonly updatePatientProfileUseCase: UpdatePatientProfileUseCase,
  ) {}

  @Post()
  create(@Body() createPatientDto: CreatePatientDto, @GetUser() user: UserContext) {
    return this.createPatientUseCase.execute(createPatientDto, user.tenantId);
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
