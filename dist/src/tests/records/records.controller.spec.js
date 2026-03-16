"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
const create_clinical_record_use_case_1 = require("../../records/application/use-cases/create-clinical-record.use-case");
const get_patient_evolution_use_case_1 = require("../../records/application/use-cases/get-patient-evolution.use-case");
const get_patient_stats_use_case_1 = require("../../records/application/use-cases/get-patient-stats.use-case");
const records_controller_1 = require("../../records/presentation/http/records.controller");
describe('RecordsController', () => {
    let controller;
    let createClinicalRecordUseCase;
    let getPatientEvolutionUseCase;
    let getPatientStatsUseCase;
    const mockUser = {
        userId: 'user-uuid',
        tenantId: 'tenant-uuid',
        role: 'patient',
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [records_controller_1.RecordsController],
            providers: [
                {
                    provide: create_clinical_record_use_case_1.CreateClinicalRecordUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue({ id: '1', weight: 80 }),
                    },
                },
                {
                    provide: get_patient_evolution_use_case_1.GetPatientEvolutionUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue([]),
                    },
                },
                {
                    provide: get_patient_stats_use_case_1.GetPatientStatsUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue({ totalDamage: 0 }),
                    },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(records_controller_1.RecordsController);
        createClinicalRecordUseCase = module.get(create_clinical_record_use_case_1.CreateClinicalRecordUseCase);
        getPatientEvolutionUseCase = module.get(get_patient_evolution_use_case_1.GetPatientEvolutionUseCase);
        getPatientStatsUseCase = module.get(get_patient_stats_use_case_1.GetPatientStatsUseCase);
    });
    it('deve chamar o use case com os dados corretos ao criar um registro', async () => {
        const dto = { weight: 85.5, skeletal_muscle_mass: 35 };
        await controller.createRecord(dto, mockUser);
        expect(createClinicalRecordUseCase.execute).toHaveBeenCalledWith(dto, mockUser);
    });
    it('deve retornar o histórico de evolução do paciente', async () => {
        const result = await controller.getEvolution(mockUser);
        expect(getPatientEvolutionUseCase.execute).toHaveBeenCalledWith(mockUser);
        expect(Array.isArray(result)).toBe(true);
    });
    it('deve retornar as estatísticas do paciente', async () => {
        await controller.getStats(mockUser);
        expect(getPatientStatsUseCase.execute).toHaveBeenCalledWith(mockUser);
    });
});
//# sourceMappingURL=records.controller.spec.js.map