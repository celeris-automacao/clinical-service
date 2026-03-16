"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const records_tokens_1 = require("../../records/records.tokens");
const assign_task_template_use_case_1 = require("../../tasks/application/use-cases/assign-task-template.use-case");
const create_task_template_use_case_1 = require("../../tasks/application/use-cases/create-task-template.use-case");
const get_categorized_ranking_use_case_1 = require("../../tasks/application/use-cases/get-categorized-ranking.use-case");
const get_daily_tasks_use_case_1 = require("../../tasks/application/use-cases/get-daily-tasks.use-case");
const get_ranking_use_case_1 = require("../../tasks/application/use-cases/get-ranking.use-case");
const get_tasks_today_use_case_1 = require("../../tasks/application/use-cases/get-tasks-today.use-case");
const list_task_templates_use_case_1 = require("../../tasks/application/use-cases/list-task-templates.use-case");
const tasks_tokens_1 = require("../../tasks/tasks.tokens");
describe('Tasks Query Use Cases', () => {
    let tasksRepository;
    let recordsRepository;
    let createTaskTemplateUseCase;
    let assignTaskTemplateUseCase;
    let listTaskTemplatesUseCase;
    let getDailyTasksUseCase;
    let getRankingUseCase;
    let getCategorizedRankingUseCase;
    let getTasksTodayUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                create_task_template_use_case_1.CreateTaskTemplateUseCase,
                assign_task_template_use_case_1.AssignTaskTemplateUseCase,
                list_task_templates_use_case_1.ListTaskTemplatesUseCase,
                get_daily_tasks_use_case_1.GetDailyTasksUseCase,
                get_ranking_use_case_1.GetRankingUseCase,
                get_categorized_ranking_use_case_1.GetCategorizedRankingUseCase,
                get_tasks_today_use_case_1.GetTasksTodayUseCase,
                {
                    provide: tasks_tokens_1.TASKS_REPOSITORY,
                    useValue: {
                        createTemplate: jest.fn(),
                        findTemplateByTitleAndType: jest.fn(),
                        findTemplateById: jest.fn(),
                        listTemplatesByTenant: jest.fn(),
                        createAssignment: jest.fn(),
                        findAssignmentsByPatient: jest.fn(),
                        findAssignmentsByPatientOnDate: jest.fn(),
                        findAssignmentById: jest.fn(),
                        findPatientById: jest.fn(),
                        findActiveAssignment: jest.fn(),
                        findPendingTasksToday: jest.fn(),
                        getPlayerStatsRanking: jest.fn(),
                        findPatientsWithActivity: jest.fn(),
                    },
                },
                {
                    provide: records_tokens_1.RECORDS_REPOSITORY,
                    useValue: {
                        getClinicalDamageByTenant: jest.fn().mockResolvedValue(new Map()),
                    },
                },
            ],
        }).compile();
        tasksRepository = module.get(tasks_tokens_1.TASKS_REPOSITORY);
        recordsRepository = module.get(records_tokens_1.RECORDS_REPOSITORY);
        createTaskTemplateUseCase = module.get(create_task_template_use_case_1.CreateTaskTemplateUseCase);
        assignTaskTemplateUseCase = module.get(assign_task_template_use_case_1.AssignTaskTemplateUseCase);
        listTaskTemplatesUseCase = module.get(list_task_templates_use_case_1.ListTaskTemplatesUseCase);
        getDailyTasksUseCase = module.get(get_daily_tasks_use_case_1.GetDailyTasksUseCase);
        getRankingUseCase = module.get(get_ranking_use_case_1.GetRankingUseCase);
        getCategorizedRankingUseCase = module.get(get_categorized_ranking_use_case_1.GetCategorizedRankingUseCase);
        getTasksTodayUseCase = module.get(get_tasks_today_use_case_1.GetTasksTodayUseCase);
    });
    it('deve criar template quando nao houver duplicidade no tenant', async () => {
        jest.spyOn(tasksRepository, 'findTemplateByTitleAndType').mockResolvedValue(null);
        jest.spyOn(tasksRepository, 'createTemplate').mockResolvedValue({ id: 'template-1' });
        const result = await createTaskTemplateUseCase.execute({
            title: 'Beber 2L de agua',
            taskType: 'water',
            xpReward: 100,
        }, 't1', 'staff-1');
        expect(tasksRepository.createTemplate).toHaveBeenCalledWith({
            title: 'Beber 2L de agua',
            taskType: 'water',
            xpReward: 100,
            tenantId: 't1',
            createdByUserId: 'staff-1',
        });
        expect(result).toEqual({ id: 'template-1' });
    });
    it('deve impedir template duplicado por titulo e tipo', async () => {
        jest.spyOn(tasksRepository, 'findTemplateByTitleAndType').mockResolvedValue({ id: 'existing' });
        await expect(createTaskTemplateUseCase.execute({
            title: 'Beber 2L de agua',
            taskType: 'water',
            xpReward: 100,
        }, 't1', 'staff-1')).rejects.toThrow(new common_1.BadRequestException('Ja existe um template de tarefa com esse titulo e tipo.'));
    });
    it('deve listar templates do tenant', async () => {
        jest.spyOn(tasksRepository, 'listTemplatesByTenant').mockResolvedValue([{ id: 'template-1' }]);
        const result = await listTaskTemplatesUseCase.execute('t1');
        expect(tasksRepository.listTemplatesByTenant).toHaveBeenCalledWith('t1');
        expect(result).toHaveLength(1);
    });
    it('deve atribuir template valido a um paciente do tenant', async () => {
        jest.spyOn(tasksRepository, 'findTemplateById').mockResolvedValue({ id: 'template-1', isActive: true });
        jest.spyOn(tasksRepository, 'findPatientById').mockResolvedValue({ id: 'patient-1' });
        jest.spyOn(tasksRepository, 'findActiveAssignment').mockResolvedValue(null);
        jest.spyOn(tasksRepository, 'createAssignment').mockResolvedValue({ id: 'assignment-1' });
        const result = await assignTaskTemplateUseCase.execute({
            templateId: 'template-1',
            patientId: 'patient-1',
            dueDate: '2026-03-20',
        }, 't1', 'staff-1');
        expect(tasksRepository.createAssignment).toHaveBeenCalledWith({
            templateId: 'template-1',
            patientId: 'patient-1',
            tenantId: 't1',
            dueDate: expect.any(Date),
            assignedByUserId: 'staff-1',
        });
        expect(result).toEqual({ id: 'assignment-1' });
    });
    it('deve aceitar atribuicao para a data de hoje quando recebida em formato YYYY-MM-DD', async () => {
        const today = new Date();
        const todayString = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            String(today.getDate()).padStart(2, '0'),
        ].join('-');
        jest.spyOn(tasksRepository, 'findTemplateById').mockResolvedValue({ id: 'template-1', isActive: true });
        jest.spyOn(tasksRepository, 'findPatientById').mockResolvedValue({ id: 'patient-1' });
        jest.spyOn(tasksRepository, 'findActiveAssignment').mockResolvedValue(null);
        jest.spyOn(tasksRepository, 'createAssignment').mockResolvedValue({ id: 'assignment-1' });
        await expect(assignTaskTemplateUseCase.execute({
            templateId: 'template-1',
            patientId: 'patient-1',
            dueDate: todayString,
        }, 't1', 'staff-1')).resolves.toEqual({ id: 'assignment-1' });
    });
    it('deve falhar quando o template nao existir', async () => {
        jest.spyOn(tasksRepository, 'findTemplateById').mockResolvedValue(null);
        jest.spyOn(tasksRepository, 'findPatientById').mockResolvedValue({ id: 'patient-1' });
        await expect(assignTaskTemplateUseCase.execute({
            templateId: 'template-1',
            patientId: 'patient-1',
            dueDate: '2026-03-20',
        }, 't1', 'staff-1')).rejects.toThrow(new common_1.NotFoundException('Template de tarefa nao encontrado.'));
    });
    it('deve listar atribuicoes do paciente', async () => {
        const mockUser = { userId: 'u1', tenantId: 't1' };
        jest.spyOn(tasksRepository, 'findAssignmentsByPatient').mockResolvedValue([{ id: 'assignment-1' }]);
        const result = await getDailyTasksUseCase.execute(mockUser);
        expect(tasksRepository.findAssignmentsByPatient).toHaveBeenCalledWith('u1', 't1');
        expect(result).toHaveLength(1);
    });
    it('deve mapear corretamente o ranking global e atribuir posicoes', async () => {
        const mockUser = { tenantId: 'tenant-123' };
        const mockPlayerStats = [
            {
                patient: { name: 'Joao Silva' },
                currentLevel: 10,
                currentXp: 500,
                totalDamageDealt: 15000,
            },
            {
                patient: null,
                currentLevel: 5,
                currentXp: 100,
                totalDamageDealt: 5000,
            },
        ];
        jest.spyOn(tasksRepository, 'getPlayerStatsRanking').mockResolvedValue(mockPlayerStats);
        const result = await getRankingUseCase.execute(mockUser);
        expect(result[0].position).toBe(1);
        expect(result[0].name).toBe('Joao Silva');
        expect(result[1].name).toBe('Herói Anônimo');
    });
    it('deve retornar o ranking categorizado integrando dano de tarefas e clinico', async () => {
        const tenantId = 't1';
        const mockPatients = [
            { id: 'p1', name: 'Paciente A', taskAssignments: [{ template: { xpReward: 1000 } }] },
        ];
        const mockClinicalDamageMap = new Map();
        mockClinicalDamageMap.set('p1', 7700);
        jest.spyOn(tasksRepository, 'findPatientsWithActivity').mockResolvedValue(mockPatients);
        jest.spyOn(recordsRepository, 'getClinicalDamageByTenant').mockResolvedValue(mockClinicalDamageMap);
        const result = await getCategorizedRankingUseCase.execute(tenantId);
        expect(result[0].missionRank).toBe(1000);
        expect(result[0].clinicalRank).toBe(7700);
        expect(result[0].totalDamage).toBe(8700);
    });
    it('deve buscar as tarefas pendentes de hoje com as horas resetadas para meia-noite', async () => {
        const mockUser = { userId: 'user-789', tenantId: 'tenant-456' };
        jest.spyOn(tasksRepository, 'findPendingTasksToday').mockResolvedValue([{ id: 'a1' }]);
        const result = await getTasksTodayUseCase.execute(mockUser);
        const expectedDate = new Date();
        expectedDate.setHours(0, 0, 0, 0);
        expect(tasksRepository.findPendingTasksToday).toHaveBeenCalledWith(mockUser.userId, mockUser.tenantId, expectedDate);
        expect(result).toHaveLength(1);
    });
});
//# sourceMappingURL=tasks-query.use-cases.spec.js.map