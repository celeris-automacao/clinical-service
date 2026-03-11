// src/tasks/tasks.controller.ts
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SupabaseGuard } from '../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../common/decorators/get-user.decorator';

@Controller('tasks')
@UseGuards(SupabaseGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) { }

  @Get()
  getDailyTasks(@GetUser() user: UserContext) {
    return this.tasksService.getDailyTasks(user);
  }

  @Post(':id/complete')
  completeTask(
    @Param('id') taskId: string,
    @GetUser() user: UserContext
  ) {
    return this.tasksService.completeTask(taskId, user);
  }
  @Get('ranking')
  @UseGuards(SupabaseGuard)
  getRanking(@GetUser() user: UserContext) {
    return this.tasksService.getRanking(user);
  }

  // No src/tasks/tasks.controller.ts

  @Get('ranking/detailed')
  @UseGuards(SupabaseGuard)
  async getDetailedRanking(@GetUser() user: UserContext) {
    // Retorna o ranking segmentado por categorias para a clínica
    return this.tasksService.getCategorizedRanking(user.tenantId);
  }

  @Get('today') // Rota: GET /v1/tasks/today 
  @UseGuards(SupabaseGuard)
  getTasksToday(@GetUser() user: UserContext) {
    return this.tasksService.getTasksToday(user);
  }

  
}