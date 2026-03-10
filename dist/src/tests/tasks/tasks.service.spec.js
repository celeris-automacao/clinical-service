"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tasks_service_1 = require("../../tasks/tasks.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const achievements_service_1 = require("../../achievements/achievements.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const common_1 = require("@nestjs/common");
const records_service_1 = require("../../records/records.service");
describe('TasksService', () => {
    let service;
    let repository;
    let recordsRepository;
    let achievementsService;
    let prisma;
    let recordsService;
    const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                tasks_service_1.TasksService,
                {
                    provide: 'ITasksRepository',
                    useValue: {
                        findTasksByTenant: jest.fn(),
                        findCompletionsByPatientToday: jest.fn(),
                        findSpecificCompletionToday: jest.fn(),
                        findById: jest.fn(),
                        getPlayerStatsRanking: jest.fn(),
                        findPendingTasksToday: jest.fn(),
                        findPatientsWithActivity: jest.fn(),
                    },
                },
                {
                    provide: 'IRecordsRepository',
                    useValue: {
                        getClinicalDamageByTenant: jest.fn().mockResolvedValue(new Map()),
                    },
                },
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        $transaction: jest.fn((cb) => cb({
                            taskCompletion: { create: jest.fn() },
                            playerStats: {
                                upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 50 }),
                                update: jest.fn(),
                            },
                            bossBattle: {
                                findFirst: jest.fn().mockResolvedValue({ id: 'boss-1', currentHp: 1000 }),
                                update: jest.fn()
                            }
                        })),
                        bossBattle: { findFirst: jest.fn() },
                    },
                },
                { provide: achievements_service_1.AchievementsService, useValue: { checkLevelAchievements: jest.fn() } },
                { provide: event_emitter_1.EventEmitter2, useValue: { emit: jest.fn() } },
                {
                    provide: records_service_1.RecordsService,
                    useValue: {
                        handleBossVictory: jest.fn().mockResolvedValue({ success: true }),
                    }
                }
            ],
        }).compile();
        service = module.get(tasks_service_1.TasksService);
        repository = module.get('ITasksRepository');
        recordsRepository = module.get('IRecordsRepository');
        achievementsService = module.get(achievements_service_1.AchievementsService);
        prisma = module.get(prisma_service_1.PrismaService);
        recordsService = module.get(records_service_1.RecordsService);
    });
    describe('completeTask', () => {
        it('deve lançar erro se a tarefa já foi completada hoje', async () => {
            jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue({ id: 'comp1' });
            await expect(service.completeTask('task1', mockUser))
                .rejects.toThrow(common_1.BadRequestException);
        });
        it('deve processar a conclusão com sucesso e dar dano no boss', async () => {
            jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue(null);
            jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'task1', xpReward: 50 });
            const result = await service.completeTask('task1', mockUser);
            expect(result.success).toBe(true);
            expect(result.xp_earned).toBe(50);
            expect(result.boss_damage).toBe(50);
        });
    });
    describe('getCategorizedRanking', () => {
        it('deve retornar o ranking categorizado integrando dano de tarefas e clínico', async () => {
            const tenantId = 't1';
            const mockPatients = [
                { id: 'p1', name: 'Paciente A', completions: [{ task: { xpReward: 1000 } }] }
            ];
            const mockClinicalDamageMap = new Map();
            mockClinicalDamageMap.set('p1', 7700);
            jest.spyOn(repository, 'findPatientsWithActivity').mockResolvedValue(mockPatients);
            jest.spyOn(recordsRepository, 'getClinicalDamageByTenant').mockResolvedValue(mockClinicalDamageMap);
            const result = await service.getCategorizedRanking(tenantId);
            expect(result[0].name).toBe('Paciente A');
            expect(result[0].missionRank).toBe(1000);
            expect(result[0].clinicalRank).toBe(7700);
            expect(result[0].totalDamage).toBe(8700);
        });
    });
    describe('getRanking', () => {
        it('deve mapear corretamente o ranking global e atribuir posições', async () => {
            const mockUser = { tenantId: 'tenant-123' };
            const mockPlayerStats = [
                {
                    patient: { name: 'João Silva' },
                    currentLevel: 10,
                    currentXp: 500,
                    totalDamageDealt: 15000
                },
                {
                    patient: null,
                    currentLevel: 5,
                    currentXp: 100,
                    totalDamageDealt: 5000
                }
            ];
            jest.spyOn(repository, 'getPlayerStatsRanking').mockResolvedValue(mockPlayerStats);
            const result = await service.getRanking(mockUser);
            expect(result).toHaveLength(2);
            expect(result[0].position).toBe(1);
            expect(result[0].name).toBe('João Silva');
            expect(result[1].position).toBe(2);
            expect(result[1].name).toBe('Herói Anônimo');
            expect(result[1].damage).toBe(5000);
        });
    });
    describe('getTasksToday', () => {
        it('deve buscar as tarefas pendentes de hoje com as horas resetadas para meia-noite', async () => {
            const mockUser = { userId: 'user-789', tenantId: 'tenant-456' };
            const mockPendingTasks = [
                { id: 'task-1', title: 'Caminhada Matinal', xpReward: 500 },
                { id: 'task-2', title: 'Beber 2L de Água', xpReward: 200 }
            ];
            jest.spyOn(repository, 'findPendingTasksToday').mockResolvedValue(mockPendingTasks);
            const result = await service.getTasksToday(mockUser);
            const expectedDate = new Date();
            expectedDate.setHours(0, 0, 0, 0);
            expect(repository.findPendingTasksToday).toHaveBeenCalledWith(mockUser.userId, mockUser.tenantId, expectedDate);
            expect(result).toEqual(mockPendingTasks);
            expect(result).toHaveLength(2);
        });
    });
    describe('getDailyTasks', () => {
        it('deve listar as tarefas do tenant e marcar corretamente as que o usuário já completou hoje', async () => {
            const mockUser = { userId: 'u1', tenantId: 't1' };
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const mockTasks = [
                { id: 'task-1', title: 'Beber Água' },
                { id: 'task-2', title: 'Caminhada' }
            ];
            const mockCompletions = [
                { taskId: 'task-1', patientId: 'u1' }
            ];
            jest.spyOn(repository, 'findTasksByTenant').mockResolvedValue(mockTasks);
            jest.spyOn(repository, 'findCompletionsByPatientToday').mockResolvedValue(mockCompletions);
            const result = await service.getDailyTasks(mockUser);
            expect(result).toHaveLength(2);
            expect(result[0].completed).toBe(true);
            expect(result[1].completed).toBe(false);
            expect(repository.findCompletionsByPatientToday).toHaveBeenCalledWith('u1', today);
        });
    });
    describe('checkAndApplyBossDamage (Private Method)', () => {
        it('deve retornar 0 de dano se a query do BossBattle não encontrar um registro ativo', async () => {
            const mockTx = {
                bossBattle: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    updateMany: jest.fn()
                }
            };
            const damage = await service.checkAndApplyBossDamage(mockTx, 'tenant-sem-boss', 100);
            expect(damage).toBe(0);
            expect(mockTx.bossBattle.updateMany).not.toHaveBeenCalled();
        });
    });
    it('deve subir de nível e disparar conquistas quando o XP atinge o limite', async () => {
        const mockTask = { id: 't1', xpReward: 1000 };
        jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue(null);
        jest.spyOn(repository, 'findById').mockResolvedValue(mockTask);
        const result = await service.completeTask('t1', mockUser);
        expect(result.level_up).toBe(true);
        expect(achievementsService.checkLevelAchievements).toHaveBeenCalledWith(mockUser.userId, mockUser.tenantId, 2);
    });
    describe('Vitória via Missão', () => {
        it('deve disparar handleBossVictory quando o dano de uma missão zerar o HP do Boss', async () => {
            const taskId = 'task-id';
            const activeBoss = { id: 'boss-1', currentHp: 50 };
            const taskReward = 100;
            jest.spyOn(repository, 'findById').mockResolvedValue({ id: taskId, xpReward: taskReward });
            jest.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
                return cb({
                    taskCompletion: { create: jest.fn() },
                    playerStats: {
                        upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 0 }),
                        update: jest.fn()
                    },
                    bossBattle: {
                        findFirst: jest.fn().mockResolvedValue(activeBoss),
                        update: jest.fn()
                    }
                });
            });
            const victorySpy = jest.spyOn(recordsService, 'handleBossVictory');
            await service.completeTask(taskId, mockUser);
            expect(victorySpy).toHaveBeenCalledWith(activeBoss.id, mockUser.tenantId);
        });
    });
});
//# sourceMappingURL=tasks.service.spec.js.map