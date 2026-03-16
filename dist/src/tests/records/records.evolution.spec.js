"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const get_patient_stats_use_case_1 = require("../../records/application/use-cases/get-patient-stats.use-case");
const clinical_progress_calculator_1 = require("../../records/domain/services/clinical-progress-calculator");
const records_tokens_1 = require("../../records/records.tokens");
describe('GetPatientStatsUseCase - Evolution & Ranking', () => {
    let useCase;
    let repository;
    const mockUser = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'patient',
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                get_patient_stats_use_case_1.GetPatientStatsUseCase,
                clinical_progress_calculator_1.ClinicalProgressCalculator,
                {
                    provide: records_tokens_1.RECORDS_REPOSITORY,
                    useValue: {
                        findAllByPatient: jest.fn(),
                    },
                },
            ],
        }).compile();
        useCase = module.get(get_patient_stats_use_case_1.GetPatientStatsUseCase);
        repository = module.get(records_tokens_1.RECORDS_REPOSITORY);
    });
    it('deve calcular corretamente o dano total acumulado (12kg = 92.400 kcal)', async () => {
        const history = [
            { weight: 100 },
            { weight: 90 },
            { weight: 95 },
            { weight: 93 },
        ];
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history);
        const stats = await useCase.execute(mockUser);
        expect(stats.totalWeightLoss).toBe(12);
        expect(stats.totalDamage).toBe(92400);
    });
    it('deve atribuir o rank "Guerreiro de Elite" para danos acima de 50.000', async () => {
        const history = [{ weight: 100 }, { weight: 90 }];
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history);
        const stats = await useCase.execute(mockUser);
        expect(stats.rank).toBe('Guerreiro de Elite');
    });
    it('deve calcular o progresso de nivel corretamente', async () => {
        const history = [{ weight: 81 }, { weight: 80 }];
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history);
        const stats = await useCase.execute(mockUser);
        expect(stats.currentLevel).toBeGreaterThanOrEqual(1);
        expect(stats.progressPercentage).toBeDefined();
    });
});
//# sourceMappingURL=records.evolution.spec.js.map