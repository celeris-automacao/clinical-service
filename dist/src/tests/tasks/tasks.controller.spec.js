"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tasks_controller_1 = require("../../tasks/tasks.controller");
const tasks_service_1 = require("../../tasks/tasks.service");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
describe('TasksController', () => {
    let controller;
    let service;
    const mockUser = {
        userId: 'user-uuid-123',
        tenantId: 'tenant-uuid-456',
        role: 'patient',
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [tasks_controller_1.TasksController],
            providers: [
                {
                    provide: tasks_service_1.TasksService,
                    useValue: {
                        getDailyTasks: jest.fn().mockResolvedValue([]),
                        completeTask: jest.fn().mockResolvedValue({ success: true }),
                        getRanking: jest.fn().mockResolvedValue([]),
                        getCategorizedRanking: jest.fn().mockResolvedValue([]),
                        getTasksToday: jest.fn().mockResolvedValue([]),
                    },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(tasks_controller_1.TasksController);
        service = module.get(tasks_service_1.TasksService);
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
//# sourceMappingURL=tasks.controller.spec.js.map