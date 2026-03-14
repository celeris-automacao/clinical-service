import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { SupabaseGuard } from '../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../common/decorators/get-user.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { GetClinicOverviewUseCase } from './application/use-cases/get-clinic-overview.use-case';
import { GetMissingPatientsUseCase } from './application/use-cases/get-missing-patients.use-case';
import { GetRecentClaimsUseCase } from './application/use-cases/get-recent-claims.use-case';

@Controller('dashboard')
@UseGuards(SupabaseGuard)
export class DashboardController {
  constructor(
    private readonly getClinicOverviewUseCase: GetClinicOverviewUseCase,
    private readonly getMissingPatientsUseCase: GetMissingPatientsUseCase,
    private readonly getRecentClaimsUseCase: GetRecentClaimsUseCase,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Visão geral da clínica para o médico (Ranking e Atividade)' })
  async getOverview(@GetUser() user: UserContext) {
    this.checkDoctorRole(user);
    return this.getClinicOverviewUseCase.execute(user.tenantId);
  }

  @Get('inactive-patients')
  async getInactive(@GetUser() user: UserContext) {
    this.checkDoctorRole(user);
    return this.getMissingPatientsUseCase.execute(user.tenantId);
  }

  @Get('recent-claims')
  async getRecentClaims(@GetUser() user: UserContext) {
    this.checkDoctorRole(user);
    return this.getRecentClaimsUseCase.execute(user.tenantId);
  }

  private checkDoctorRole(user: UserContext) {
    if (user.role !== 'admin' && user.role !== 'doctor') {
      throw new ForbiddenException('Acesso restrito a médicos e administradores.');
    }
  }
}
