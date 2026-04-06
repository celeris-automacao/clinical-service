import { Body, Controller, Get, Param, Post, Patch, UseGuards, Query } from '@nestjs/common';
import { CreatePlanUseCase } from '../../application/use-cases/create-plan.use-case';
import { GetPlanByIdUseCase } from '../../application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from '../../application/use-cases/get-plans.use-case';
import { RequestPlanUpgradeUseCase } from '../../application/use-cases/request-plan-upgrade.use-case';
import { GetPendingUpgradeRequestUseCase } from '../../application/use-cases/get-pending-upgrade-request.use-case';
import { GetUpgradeRequestsUseCase } from '../../application/use-cases/get-upgrade-requests.use-case';
import { ResolveUpgradeRequestUseCase } from '../../application/use-cases/resolve-upgrade-request.use-case';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateUpgradeRequestDto } from './dto/create-upgrade-request.dto';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { UserContext } from '../../../shared/auth/user-context';

@Controller('plans')
@UseGuards(SupabaseGuard, RolesGuard)
export class PlansController {
  constructor(
    private readonly createPlanUseCase: CreatePlanUseCase,
    private readonly getPlansUseCase: GetPlansUseCase,
    private readonly getPlanByIdUseCase: GetPlanByIdUseCase,
    private readonly requestPlanUpgradeUseCase: RequestPlanUpgradeUseCase,
    private readonly getPendingUpgradeRequestUseCase: GetPendingUpgradeRequestUseCase,
    private readonly getUpgradeRequestsUseCase: GetUpgradeRequestsUseCase,
    private readonly resolveUpgradeRequestUseCase: ResolveUpgradeRequestUseCase,
  ) {}

  @Post()
  @Roles('superadmin')
  create(@Body() dto: CreatePlanDto) {
    return this.createPlanUseCase.execute(dto);
  }

  @Get()
  findAll() {
    return this.getPlansUseCase.execute();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getPlanByIdUseCase.execute(id);
  }

  // Rotas de Upgrade - Clinic Owner
  @Get('upgrade-request/pending')
  getPendingRequest(@GetUser() user: UserContext) {
    return this.getPendingUpgradeRequestUseCase.execute(user.tenantId);
  }

  @Post('upgrade-request')
  @Roles('clinic_owner')
  async requestUpgrade(
    @GetUser() user: UserContext,
    @Body() dto: CreateUpgradeRequestDto,
  ) {
    return this.requestPlanUpgradeUseCase.execute(user.tenantId, dto.targetPlanId);
  }

  // Rotas de Upgrade - SaaS Admin
  @Get('admin/upgrade-requests')
  @Roles('superadmin')
  getUpgradeRequests(@Query('status') status?: string) {
    return this.getUpgradeRequestsUseCase.execute(status);
  }

  @Patch('admin/upgrade-requests/:id/:action')
  @Roles('superadmin')
  resolveUpgradeRequest(
    @Param('id') id: string,
    @Param('action') action: 'approve' | 'reject',
    @GetUser() user: UserContext,
  ) {
    return this.resolveUpgradeRequestUseCase.execute(id, action, user.userId);
  }
}
