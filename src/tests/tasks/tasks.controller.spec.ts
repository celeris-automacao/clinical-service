import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { UserContext } from '../../common/decorators/get-user.decorator';
import { CompleteTaskUseCase } from '../../tasks/application/use-cases/complete-task.use-case';
import { GetCategorizedRankingUseCase } from '../../tasks/application/use-cases/get-categorized-ranking.use-case';
import { GetDailyTasksUseCase } from '../../tasks/application/use-cases/get-daily-tasks.use-case';
import { GetRankingUseCase } from '../../tasks/application/use-cases/get-ranking.use-case';
import { GetTasksTodayUseCase } from '../../tasks/application/use-cases/get-tasks-today.use-case';
import { TasksController } from '../../tasks/tasks.controller';

describe('TasksController', () => {
  let controller: TasksController;
  let getDailyTasksUseCase: GetDailyTasksUseCase;
  let completeTaskUseCase: CompleteTaskUseCase;
  let getRankingUseCase: GetRankingUseCase;
  let getTasksTodayUseCase: GetTasksTodayUseCase;

  const mockUser: UserContext = {
    userId: 'user-uuid-123',
    tenantId: 'tenant-uuid-456',
    role: 'patient',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: GetDailyTasksUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
        { provide: CompleteTaskUseCase, useValue: { execute: jest.fn().mockResolvedValue({ success: true }) } },
        { provide: GetRankingUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
        { provide: GetCategorizedRankingUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
        { provide: GetTasksTodayUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TasksController>(TasksController);
    getDailyTasksUseCase = module.get<GetDailyTasksUseCase>(GetDailyTasksUseCase);
    completeTaskUseCase = module.get<CompleteTaskUseCase>(CompleteTaskUseCase);
    getRankingUseCase = module.get<GetRankingUseCase>(GetRankingUseCase);
    getTasksTodayUseCase = module.get<GetTasksTodayUseCase>(GetTasksTodayUseCase);
  });

  it('deve chamar o use case de tarefas diárias com o contexto do usuário', async () => {
    await controller.getDailyTasks(mockUser);
    expect(getDailyTasksUseCase.execute).toHaveBeenCalledWith(mockUser);
  });

  it('deve extrair o ID da URL e o contexto do usuário corretamente', async () => {
    const taskId = 'task-123';
    await controller.completeTask(taskId, mockUser);

    expect(completeTaskUseCase.execute).toHaveBeenCalledWith(taskId, mockUser);
  });

  it('deve chamar a busca de ranking para o tenant do usuário', async () => {
    await controller.getRanking(mockUser);
    expect(getRankingUseCase.execute).toHaveBeenCalledWith(mockUser);
  });

  it('deve retornar apenas as tarefas agendadas para hoje', async () => {
    await controller.getTasksToday(mockUser);
    expect(getTasksTodayUseCase.execute).toHaveBeenCalledWith(mockUser);
  });
});
