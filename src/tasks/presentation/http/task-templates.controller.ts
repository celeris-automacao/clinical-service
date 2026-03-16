import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserContext } from '../../../shared/auth/user-context';
import { CreateTaskTemplateUseCase } from '../../application/use-cases/create-task-template.use-case';
import { ListTaskTemplatesUseCase } from '../../application/use-cases/list-task-templates.use-case';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';

@Controller('task-templates')
@UseGuards(SupabaseGuard, RolesGuard)
@Roles('owner', 'admin', 'doctor', 'specialist')
export class TaskTemplatesController {
  constructor(
    private readonly createTaskTemplateUseCase: CreateTaskTemplateUseCase,
    private readonly listTaskTemplatesUseCase: ListTaskTemplatesUseCase,
  ) {}

  @Post()
  create(@Body() dto: CreateTaskTemplateDto, @GetUser() user: UserContext) {
    return this.createTaskTemplateUseCase.execute(dto, user.tenantId, user.userId);
  }

  @Get()
  list(@GetUser() user: UserContext) {
    return this.listTaskTemplatesUseCase.execute(user.tenantId);
  }
}
