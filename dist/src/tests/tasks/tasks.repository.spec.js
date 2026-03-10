"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tasks_repository_1 = require("../../tasks/repositories/tasks.repository");
const prisma_service_1 = require("../../prisma/prisma.service");
describe('TasksRepository', () => {
    let repository;
    let prisma;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                tasks_repository_1.TasksRepository,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        dailyTask: {
                            findMany: jest.fn(),
                            findUnique: jest.fn(),
                        },
                        taskCompletion: {
                            findMany: jest.fn(),
                            findFirst: jest.fn(),
                        },
                        playerStats: {
                            findMany: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();
        repository = module.get(tasks_repository_1.TasksRepository);
        prisma = module.get(prisma_service_1.PrismaService);
    });
    describe('findTasksByTenant', () => {
        it('deve buscar tarefas ativas filtrando pelo tenantId', async () => {
            const tenantId = 'tenant-123';
            await repository.findTasksByTenant(tenantId);
            expect(prisma.dailyTask.findMany).toHaveBeenCalledWith({
                where: { tenantId, isCompleted: true },
            });
        });
    });
    describe('findCompletionsByPatientToday', () => {
        it('deve buscar conclusões do paciente a partir do início do dia', async () => {
            const patientId = 'user-1';
            const startOfDay = new Date('2026-03-03T00:00:00Z');
            await repository.findCompletionsByPatientToday(patientId, startOfDay);
            expect(prisma.taskCompletion.findMany).toHaveBeenCalledWith({
                where: {
                    patientId,
                    completedAt: { gte: startOfDay },
                },
            });
        });
    });
    describe('findSpecificCompletionToday', () => {
        it('deve verificar se uma tarefa específica foi concluída no intervalo de tempo', async () => {
            const taskId = 'task-1';
            const patientId = 'user-1';
            const start = new Date('2026-03-03T00:00:00Z');
            const end = new Date('2026-03-03T23:59:59Z');
            await repository.findSpecificCompletionToday(taskId, patientId, start, end);
            expect(prisma.taskCompletion.findFirst).toHaveBeenCalledWith({
                where: {
                    taskId,
                    patientId,
                    completedAt: { gte: start, lte: end },
                },
            });
        });
    });
    describe('findPendingTasksToday', () => {
        it('deve buscar tarefas agendadas para hoje que ainda não foram concluídas', async () => {
            const userId = 'user-1';
            const tenantId = 'tenant-1';
            const today = new Date('2026-03-03');
            await repository.findPendingTasksToday(userId, tenantId, today);
            expect(prisma.dailyTask.findMany).toHaveBeenCalledWith({
                where: {
                    patientId: userId,
                    tenantId: tenantId,
                    isCompleted: false,
                    dueDate: today,
                },
                orderBy: { createdAt: 'asc' },
            });
        });
    });
    describe('getPlayerStatsRanking', () => {
        it('deve buscar o ranking ordenado por nível, XP e dano', async () => {
            const tenantId = 'tenant-1';
            await repository.getPlayerStatsRanking(tenantId);
            expect(prisma.playerStats.findMany).toHaveBeenCalledWith({
                where: { tenantId },
                select: {
                    currentLevel: true,
                    currentXp: true,
                    totalDamageDealt: true,
                    patient: { select: { name: true } }
                },
                orderBy: [
                    { currentLevel: 'desc' },
                    { currentXp: 'desc' },
                    { totalDamageDealt: 'desc' }
                ],
            });
        });
    });
});
//# sourceMappingURL=tasks.repository.spec.js.map