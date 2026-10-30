import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserContext } from '../../../shared/auth/user-context';
import { CreatePlanUpgradeRequestUseCase } from '../../application/use-cases/create-plan-upgrade-request.use-case';
import { CreatePlanUseCase } from '../../application/use-cases/create-plan.use-case';
import { GetPendingPlanUpgradeRequestUseCase } from '../../application/use-cases/get-pending-plan-upgrade-request.use-case';
import { GetPlanByIdUseCase } from '../../application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from '../../application/use-cases/get-plans.use-case';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreatePlanUpgradeRequestDto } from './dto/create-plan-upgrade-request.dto';

@Controller('plans')
export class PlansController {
  constructor(
    private readonly createPlanUseCase: CreatePlanUseCase,
    private readonly getPlansUseCase: GetPlansUseCase,
    private readonly getPlanByIdUseCase: GetPlanByIdUseCase,
    private readonly getPendingPlanUpgradeRequestUseCase: GetPendingPlanUpgradeRequestUseCase,
    private readonly createPlanUpgradeRequestUseCase: CreatePlanUpgradeRequestUseCase,
  ) {}

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.createPlanUseCase.execute(dto);
  }

  @Get()
  findAll() {
    return this.getPlansUseCase.execute();
  }

  @Get('upgrade-request/pending')
  @UseGuards(SupabaseGuard, RolesGuard)
  @Roles('owner', 'admin')
  getPendingUpgradeRequest(@GetUser() user: UserContext) {
    return this.getPendingPlanUpgradeRequestUseCase.execute(user.tenantId);
  }

  @Post('upgrade-request')
  @UseGuards(SupabaseGuard, RolesGuard)
  @Roles('owner', 'admin')
  createUpgradeRequest(
    @Body() dto: CreatePlanUpgradeRequestDto,
    @GetUser() user: UserContext,
  ) {
    return this.createPlanUpgradeRequestUseCase.execute(
      user.tenantId,
      user.userId,
      dto.targetPlanId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getPlanByIdUseCase.execute(id);
  }
}
