"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const client_1 = require("@prisma/client");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
const patients_controller_1 = require("../../patients/presentation/http/patients.controller");
const create_patient_use_case_1 = require("../../patients/application/use-cases/create-patient.use-case");
const get_patient_by_id_use_case_1 = require("../../patients/application/use-cases/get-patient-by-id.use-case");
const update_patient_profile_use_case_1 = require("../../patients/application/use-cases/update-patient-profile.use-case");
describe('PatientsController', () => {
    let controller;
    let createPatientUseCase;
    let getPatientByIdUseCase;
    let updatePatientProfileUseCase;
    const user = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'doctor',
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [patients_controller_1.PatientsController],
            providers: [
                {
                    provide: create_patient_use_case_1.CreatePatientUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue({ id: 'patient-1' }),
                    },
                },
                {
                    provide: get_patient_by_id_use_case_1.GetPatientByIdUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue({ id: 'patient-1' }),
                    },
                },
                {
                    provide: update_patient_profile_use_case_1.UpdatePatientProfileUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue({ patientId: 'patient-1' }),
                    },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: jest.fn().mockReturnValue(true) })
            .compile();
        controller = module.get(patients_controller_1.PatientsController);
        createPatientUseCase = module.get(create_patient_use_case_1.CreatePatientUseCase);
        getPatientByIdUseCase = module.get(get_patient_by_id_use_case_1.GetPatientByIdUseCase);
        updatePatientProfileUseCase = module.get(update_patient_profile_use_case_1.UpdatePatientProfileUseCase);
    });
    it('deve repassar o dto e o tenant do usuario para o use case de criacao', async () => {
        const dto = {
            supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            name: 'Paciente Teste',
            gender: client_1.Gender.MALE,
            birthDate: '1990-01-01',
        };
        await controller.create(dto, user);
        expect(createPatientUseCase.execute).toHaveBeenCalledWith(dto, 'tenant-1');
    });
    it('deve repassar o id e o tenant para o use case de busca', async () => {
        await controller.findOne('patient-1', user);
        expect(getPatientByIdUseCase.execute).toHaveBeenCalledWith('patient-1', 'tenant-1');
    });
    it('deve repassar id, tenant e dto para o use case de updateProfile', async () => {
        const dto = {
            initialGoals: 'Perder peso',
            symptoms: 'Cansaco',
        };
        await controller.updateProfile('patient-1', dto, user);
        expect(updatePatientProfileUseCase.execute).toHaveBeenCalledWith('patient-1', 'tenant-1', dto);
    });
});
//# sourceMappingURL=patients.controller.spec.js.map