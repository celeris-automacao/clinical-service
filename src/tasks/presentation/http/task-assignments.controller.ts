import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserContext } from '../../../shared/auth/user-context';
import { AssignTaskTemplateUseCase } from '../../application/use-cases/assign-task-template.use-case';
import { BulkAssignTaskTemplateUseCase } from '../../application/use-cases/bulk-assign-task-template.use-case';
import { AssignTaskTemplateDto } from './dto/assign-task-template.dto';
import { BulkAssignTaskTemplateDto } from './dto/bulk-assign-task-template.dto';

@Controller('task-assignments')
@UseGuards(SupabaseGuard, RolesGuard)
@Roles('owner', 'admin', 'doctor', 'specialist')
export class TaskAssignmentsController {
  constructor(
    private readonly assignTaskTemplateUseCase: AssignTaskTemplateUseCase,
    private readonly bulkAssignTaskTemplateUseCase: BulkAssignTaskTemplateUseCase,
  ) {}

  @Post()
  assign(@Body() dto: AssignTaskTemplateDto, @GetUser() user: UserContext) {
    return this.assignTaskTemplateUseCase.execute(dto, user.tenantId, user.userId);
  }

  @Post('bulk')
  bulkAssign(@Body() dto: BulkAssignTaskTemplateDto, @GetUser() user: UserContext) {
    return this.bulkAssignTaskTemplateUseCase.execute(dto, user.tenantId, user.userId);
  }
}
