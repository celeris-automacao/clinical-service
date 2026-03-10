"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const dashboard_service_1 = require("../../dashboard/dashboard.service");
describe('DashboardService - Suite Completa', () => {
    let service;
    let repository;
    const mockTenantId = 'tenant-123';
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                dashboard_service_1.DashboardService,
                {
                    provide: 'IDashboardRepository',
                    useValue: {
                        countActivePlayers: jest.fn(),
                        findRecentAchievements: jest.fn(),
                        findTopPlayers: jest.fn(),
                        getTaskCompletionsHistory: jest.fn(),
                    },
                },
            ],
        }).compile();
        service = module.get(dashboard_service_1.DashboardService);
        repository = module.get('IDashboardRepository');
    });
    describe('getClinicOverview', () => {
        it('deve retornar zeros e listas vazias quando não houver dados na clínica', async () => {
            repository.countActivePlayers.mockResolvedValue(0);
            repository.findRecentAchievements.mockResolvedValue([]);
            repository.findTopPlayers.mockResolvedValue([]);
            const result = await service.getClinicOverview(mockTenantId);
            expect(result.activeToday).toBe(0);
            expect(result.recentAchievements).toHaveLength(0);
            expect(result.ranking).toHaveLength(0);
        });
    });
    describe('getMissingPatients', () => {
        it('deve identificar corretamente a ÚLTIMA atividade de um paciente com múltiplos registros', async () => {
            const today = new Date();
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(today.getDate() - 10);
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            const mockHistory = [
                { patientId: 'p1', completedAt: yesterday },
                { patientId: 'p1', completedAt: tenDaysAgo }
            ];
            repository.getTaskCompletionsHistory.mockResolvedValue(mockHistory);
            const result = await service.getMissingPatients(mockTenantId, 3);
            expect(result).toHaveLength(0);
        });
        it('deve respeitar o parâmetro customizado de dias de inatividade', async () => {
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(new Date().getDate() - 5);
            repository.getTaskCompletionsHistory.mockResolvedValue([
                { patientId: 'p2', completedAt: fiveDaysAgo }
            ]);
            const resultAtivo = await service.getMissingPatients(mockTenantId, 7);
            expect(resultAtivo).toHaveLength(0);
            const resultInativo = await service.getMissingPatients(mockTenantId, 3);
            expect(resultInativo).toHaveLength(1);
        });
        it('deve retornar lista vazia se ninguém tiver completado tarefas na clínica', async () => {
            repository.getTaskCompletionsHistory.mockResolvedValue([]);
            const result = await service.getMissingPatients(mockTenantId);
            expect(result).toEqual([]);
        });
    });
});
//# sourceMappingURL=dashboard.service.spec.js.map