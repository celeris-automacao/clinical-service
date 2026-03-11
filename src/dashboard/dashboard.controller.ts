// src/dashboard/dashboard.controller.ts
import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SupabaseGuard } from '../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../common/decorators/get-user.decorator';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@Controller('dashboard')
@UseGuards(SupabaseGuard)
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService // <--- Faltava esta linha
  ) { }

  @Get('overview')
  @ApiOperation({ summary: 'Visão geral da clínica para o médico (Ranking e Atividade)' })
  async getOverview(@GetUser() user: UserContext) {
    this.checkDoctorRole(user);
    return this.dashboardService.getClinicOverview(user.tenantId);
  }

  @Get('inactive-patients')
  async getInactive(@GetUser() user: UserContext) {
    if (user.role !== 'admin' && user.role !== 'doctor') {
      throw new ForbiddenException('Acesso restrito a médicos e administradores.');
    }
    return this.dashboardService.getMissingPatients(user.tenantId);
  }

  @Get('recent-claims')
  @UseGuards(SupabaseGuard)
  async getRecentClaims(@GetUser() user: UserContext) {
    if (user.role !== 'admin' && user.role !== 'doctor') {
      throw new ForbiddenException('Acesso restrito.');
    }

    return this.prisma.rewardClaim.findMany({
      where: { tenantId: user.tenantId },
      include: { reward: true },
      orderBy: { claimedAt: 'desc' },
      take: 10 // Últimos 10 resgates da clínica
    });
  }

  checkDoctorRole(user: UserContext) {
    if (user.role !== 'admin' && user.role !== 'doctor') {
      throw new ForbiddenException('Acesso restrito a médicos e administradores.');
    }
  }
}

