"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const handle_boss_victory_use_case_1 = require("../../records/application/use-cases/handle-boss-victory.use-case");
const shared_tokens_1 = require("../../shared/shared.tokens");
const complete_task_use_case_1 = require("../../tasks/application/use-cases/complete-task.use-case");
const tasks_tokens_1 = require("../../tasks/tasks.tokens");
describe('CompleteTaskUseCase', () => {
    let useCase;
    let repository;
    let transactionPort;
    let tasksAchievementsPort;
    let handleBossVictoryUseCase;
    const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                complete_task_use_case_1.CompleteTaskUseCase,
                {
                    provide: tasks_tokens_1.TASKS_REPOSITORY,
                    useValue: {
                        findAssignmentById: jest.fn(),
                    },
                },
                {
                    provide: tasks_tokens_1.TASK_COMPLETION_TRANSACTION_PORT,
                    useValue: {
                        execute: jest.fn(),
                    },
                },
                { provide: shared_tokens_1.APPLICATION_EVENT_BUS, useValue: { publish: jest.fn() } },
                {
                    provide: tasks_tokens_1.TASKS_ACHIEVEMENTS_PORT,
                    useValue: {
                        checkLevelAchievements: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: handle_boss_victory_use_case_1.HandleBossVictoryUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();
        useCase = module.get(complete_task_use_case_1.CompleteTaskUseCase);
        repository = module.get(tasks_tokens_1.TASKS_REPOSITORY);
        transactionPort = module.get(tasks_tokens_1.TASK_COMPLETION_TRANSACTION_PORT);
        tasksAchievementsPort = module.get(tasks_tokens_1.TASKS_ACHIEVEMENTS_PORT);
        handleBossVictoryUseCase = module.get(handle_boss_victory_use_case_1.HandleBossVictoryUseCase);
    });
    it('deve lancar erro se a atribuicao nao existir para o paciente', async () => {
        jest.spyOn(repository, 'findAssignmentById').mockResolvedValue(null);
        await expect(useCase.execute('assignment-1', mockUser)).rejects.toThrow(new common_1.BadRequestException('Missao nao encontrada.'));
    });
    it('deve lancar erro se a atribuicao ja estiver concluida', async () => {
        jest.spyOn(repository, 'findAssignmentById').mockResolvedValue({
            id: 'assignment-1',
            patientId: 'u1',
            status: 'completed',
            template: { xpReward: 50 },
        });
        await expect(useCase.execute('assignment-1', mockUser)).rejects.toThrow(new common_1.BadRequestException('Voce ja completou esta missao.'));
    });
    it('deve processar a conclusao com sucesso e dar dano no boss', async () => {
        jest.spyOn(repository, 'findAssignmentById').mockResolvedValue({
            id: 'assignment-1',
            patientId: 'u1',
            status: 'pending',
            template: { xpReward: 50 },
        });
        jest.spyOn(transactionPort, 'execute').mockResolvedValue({
            newXp: 100,
            newLevel: 1,
            leveledUp: false,
            bossDamage: 50,
        });
        const result = await useCase.execute('assignment-1', mockUser);
        expect(result.success).toBe(true);
        expect(result.xp_earned).toBe(50);
        expect(result.boss_damage).toBe(50);
    });
    it('deve subir de nivel e disparar conquistas quando o XP atinge o limite', async () => {
        jest.spyOn(repository, 'findAssignmentById').mockResolvedValue({
            id: 'assignment-1',
            patientId: 'u1',
            status: 'pending',
            template: { xpReward: 1000 },
        });
        jest.spyOn(transactionPort, 'execute').mockResolvedValue({
            newXp: 1050,
            newLevel: 2,
            leveledUp: true,
            bossDamage: 1000,
        });
        const result = await useCase.execute('assignment-1', mockUser);
        expect(result.level_up).toBe(true);
        expect(tasksAchievementsPort.checkLevelAchievements).toHaveBeenCalledWith({
            patientId: mockUser.userId,
            tenantId: mockUser.tenantId,
            newLevel: 2,
        });
    });
    it('deve disparar o use case de vitoria quando a transacao indicar boss derrotado', async () => {
        jest.spyOn(repository, 'findAssignmentById').mockResolvedValue({
            id: 'assignment-1',
            patientId: 'u1',
            status: 'pending',
            template: { xpReward: 100 },
        });
        jest.spyOn(transactionPort, 'execute').mockResolvedValue({
            newXp: 100,
            newLevel: 1,
            leveledUp: false,
            bossDamage: 100,
            defeatedBossId: 'boss-1',
        });
        await useCase.execute('assignment-1', mockUser);
        expect(handleBossVictoryUseCase.execute).toHaveBeenCalledWith('boss-1', mockUser.tenantId, mockUser.userId);
    });
});
//# sourceMappingURL=complete-task.use-case.spec.js.map