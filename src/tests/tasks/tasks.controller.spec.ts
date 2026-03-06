import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from '../../tasks/tasks.controller';
import { TasksService } from '../../tasks/tasks.service';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { UserContext } from '../../common/decorators/get-user.decorator';

describe('TasksController', () => {
    let controller: TasksController;
    let service: TasksService;

    // Mock do contexto do usuário (JWT extraído)
    const mockUser: UserContext = {
        userId: 'user-uuid-123',
        tenantId: 'tenant-uuid-456',
        role: 'patient',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TasksController],
            providers: [
                {
                    provide: TasksService,
                    useValue: {
                        getDailyTasks: jest.fn().mockResolvedValue([]),
                        completeTask: jest.fn().mockResolvedValue({ success: true }),
                        getRanking: jest.fn().mockResolvedValue([]),
                        getCategorizedRanking: jest.fn().mockResolvedValue([]), // ADICIONE ESTA LINHA
                        getTasksToday: jest.fn().mockResolvedValue([]),
                    },
                },
            ],
        })
            // Sobrescrevemos o Guard para não precisar de um token real nos testes
            .overrideGuard(SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<TasksController>(TasksController);
        service = module.get<TasksService>(TasksService);
    });

    describe('getDailyTasks', () => {
        it('deve chamar o service passando o contexto do usuário logado', async () => {
            await controller.getDailyTasks(mockUser);
            expect(service.getDailyTasks).toHaveBeenCalledWith(mockUser);
        });
    });

    describe('completeTask', () => {
        it('deve extrair o ID da URL e o contexto do usuário corretamente', async () => {
            const taskId = 'task-123';
            await controller.completeTask(taskId, mockUser);

            expect(service.completeTask).toHaveBeenCalledWith(taskId, mockUser);
        });
    });

    describe('getRanking', () => {
        it('deve chamar a busca de ranking para o tenant do usuário', async () => {
            await controller.getRanking(mockUser);
            expect(service.getRanking).toHaveBeenCalledWith(mockUser);
        });
    });

    describe('getTasksToday', () => {
        it('deve retornar apenas as tarefas agendadas para hoje', async () => {
            await controller.getTasksToday(mockUser);
            expect(service.getTasksToday).toHaveBeenCalledWith(mockUser);
        });
    });
});