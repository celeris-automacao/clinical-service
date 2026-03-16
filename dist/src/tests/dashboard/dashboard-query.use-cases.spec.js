"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const get_clinic_overview_use_case_1 = require("../../dashboard/application/use-cases/get-clinic-overview.use-case");
const get_missing_patients_use_case_1 = require("../../dashboard/application/use-cases/get-missing-patients.use-case");
const get_recent_claims_use_case_1 = require("../../dashboard/application/use-cases/get-recent-claims.use-case");
const dashboard_tokens_1 = require("../../dashboard/dashboard.tokens");
describe('Dashboard Query Use Cases', () => {
    let repository;
    let getClinicOverviewUseCase;
    let getMissingPatientsUseCase;
    let getRecentClaimsUseCase;
    const mockTenantId = 'tenant-123';
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                get_clinic_overview_use_case_1.GetClinicOverviewUseCase,
                get_missing_patients_use_case_1.GetMissingPatientsUseCase,
                get_recent_claims_use_case_1.GetRecentClaimsUseCase,
                {
                    provide: dashboard_tokens_1.DASHBOARD_REPOSITORY,
                    useValue: {
                        countActivePlayers: jest.fn(),
                        findRecentAchievements: jest.fn(),
                        findTopPlayers: jest.fn(),
                        getTaskCompletionsHistory: jest.fn(),
                        findRecentClaims: jest.fn(),
                    },
                },
            ],
        }).compile();
        repository = module.get(dashboard_tokens_1.DASHBOARD_REPOSITORY);
        getClinicOverviewUseCase = module.get(get_clinic_overview_use_case_1.GetClinicOverviewUseCase);
        getMissingPatientsUseCase = module.get(get_missing_patients_use_case_1.GetMissingPatientsUseCase);
        getRecentClaimsUseCase = module.get(get_recent_claims_use_case_1.GetRecentClaimsUseCase);
    });
    it('deve retornar zeros e listas vazias quando não houver dados na clínica', async () => {
        repository.countActivePlayers.mockResolvedValue(0);
        repository.findRecentAchievements.mockResolvedValue([]);
        repository.findTopPlayers.mockResolvedValue([]);
        const result = await getClinicOverviewUseCase.execute(mockTenantId);
        expect(result.activeToday).toBe(0);
        expect(result.recentAchievements).toHaveLength(0);
        expect(result.ranking).toHaveLength(0);
    });
    it('deve identificar corretamente a última atividade de um paciente com múltiplos registros', async () => {
        const today = new Date();
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(today.getDate() - 10);
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        repository.getTaskCompletionsHistory.mockResolvedValue([
            { patientId: 'p1', completedAt: yesterday },
            { patientId: 'p1', completedAt: tenDaysAgo },
        ]);
        const result = await getMissingPatientsUseCase.execute(mockTenantId, 3);
        expect(result).toHaveLength(0);
    });
    it('deve respeitar o parâmetro customizado de dias de inatividade', async () => {
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(new Date().getDate() - 5);
        repository.getTaskCompletionsHistory.mockResolvedValue([
            { patientId: 'p2', completedAt: fiveDaysAgo },
        ]);
        const resultAtivo = await getMissingPatientsUseCase.execute(mockTenantId, 7);
        expect(resultAtivo).toHaveLength(0);
        const resultInativo = await getMissingPatientsUseCase.execute(mockTenantId, 3);
        expect(resultInativo).toHaveLength(1);
    });
    it('deve retornar lista vazia se ninguém tiver completado tarefas na clínica', async () => {
        repository.getTaskCompletionsHistory.mockResolvedValue([]);
        const result = await getMissingPatientsUseCase.execute(mockTenantId);
        expect(result).toEqual([]);
    });
    it('deve buscar os resgates recentes limitando em 10 por tenant', async () => {
        const claims = [{ id: 'claim-1' }];
        repository.findRecentClaims.mockResolvedValue(claims);
        const result = await getRecentClaimsUseCase.execute(mockTenantId);
        expect(repository.findRecentClaims).toHaveBeenCalledWith(mockTenantId, 10);
        expect(result).toEqual(claims);
    });
});
//# sourceMappingURL=dashboard-query.use-cases.spec.js.map