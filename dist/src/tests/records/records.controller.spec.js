"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const records_controller_1 = require("../../records/records.controller");
const records_service_1 = require("../../records/records.service");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
describe('RecordsController', () => {
    let controller;
    let service;
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
                    provide: records_service_1.RecordsService,
                    useValue: {
                        createRecord: jest.fn().mockResolvedValue({ id: '1', weight: 80 }),
                        getEvolution: jest.fn().mockResolvedValue([]),
                        getStats: jest.fn().mockResolvedValue({ totalDamage: 0 }),
                    },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(records_controller_1.RecordsController);
        service = module.get(records_service_1.RecordsService);
    });
    it('deve chamar o service com os dados corretos ao criar um registro', async () => {
        const dto = { weight: 85.5, skeletal_muscle_mass: 35 };
        await controller.createRecord(dto, mockUser);
        expect(service.createRecord).toHaveBeenCalledWith(dto, mockUser);
    });
    it('deve retornar o histórico de evolução do paciente', async () => {
        const result = await controller.getEvolution(mockUser);
        expect(service.getEvolution).toHaveBeenCalledWith(mockUser);
        expect(Array.isArray(result)).toBe(true);
    });
});
//# sourceMappingURL=records.controller.spec.js.map