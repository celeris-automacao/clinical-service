"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
const complete_task_use_case_1 = require("../../tasks/application/use-cases/complete-task.use-case");
const get_categorized_ranking_use_case_1 = require("../../tasks/application/use-cases/get-categorized-ranking.use-case");
const get_daily_tasks_use_case_1 = require("../../tasks/application/use-cases/get-daily-tasks.use-case");
const get_ranking_use_case_1 = require("../../tasks/application/use-cases/get-ranking.use-case");
const get_tasks_today_use_case_1 = require("../../tasks/application/use-cases/get-tasks-today.use-case");
const tasks_controller_1 = require("../../tasks/presentation/http/tasks.controller");
describe('TasksController', () => {
    let controller;
    let getDailyTasksUseCase;
    let completeTaskUseCase;
    let getRankingUseCase;
    let getTasksTodayUseCase;
    const mockUser = {
        userId: 'user-uuid-123',
        tenantId: 'tenant-uuid-456',
        role: 'patient',
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [tasks_controller_1.TasksController],
            providers: [
                { provide: get_daily_tasks_use_case_1.GetDailyTasksUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
                { provide: complete_task_use_case_1.CompleteTaskUseCase, useValue: { execute: jest.fn().mockResolvedValue({ success: true }) } },
                { provide: get_ranking_use_case_1.GetRankingUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
                { provide: get_categorized_ranking_use_case_1.GetCategorizedRankingUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
                { provide: get_tasks_today_use_case_1.GetTasksTodayUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(tasks_controller_1.TasksController);
        getDailyTasksUseCase = module.get(get_daily_tasks_use_case_1.GetDailyTasksUseCase);
        completeTaskUseCase = module.get(complete_task_use_case_1.CompleteTaskUseCase);
        getRankingUseCase = module.get(get_ranking_use_case_1.GetRankingUseCase);
        getTasksTodayUseCase = module.get(get_tasks_today_use_case_1.GetTasksTodayUseCase);
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
//# sourceMappingURL=tasks.controller.spec.js.map