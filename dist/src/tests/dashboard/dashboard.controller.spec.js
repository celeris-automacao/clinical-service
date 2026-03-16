"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const dashboard_controller_1 = require("../../dashboard/presentation/http/dashboard.controller");
const get_clinic_overview_use_case_1 = require("../../dashboard/application/use-cases/get-clinic-overview.use-case");
const get_missing_patients_use_case_1 = require("../../dashboard/application/use-cases/get-missing-patients.use-case");
const get_recent_claims_use_case_1 = require("../../dashboard/application/use-cases/get-recent-claims.use-case");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
describe('DashboardController', () => {
    let controller;
    let getClinicOverviewUseCase;
    let getMissingPatientsUseCase;
    let getRecentClaimsUseCase;
    const mockDoctor = { userId: 'd1', tenantId: 't1', role: 'doctor' };
    const mockPatient = { userId: 'p1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [dashboard_controller_1.DashboardController],
            providers: [
                {
                    provide: get_clinic_overview_use_case_1.GetClinicOverviewUseCase,
                    useValue: { execute: jest.fn().mockResolvedValue({}) },
                },
                {
                    provide: get_missing_patients_use_case_1.GetMissingPatientsUseCase,
                    useValue: { execute: jest.fn().mockResolvedValue([]) },
                },
                {
                    provide: get_recent_claims_use_case_1.GetRecentClaimsUseCase,
                    useValue: { execute: jest.fn().mockResolvedValue([]) },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(dashboard_controller_1.DashboardController);
        getClinicOverviewUseCase = module.get(get_clinic_overview_use_case_1.GetClinicOverviewUseCase);
        getMissingPatientsUseCase = module.get(get_missing_patients_use_case_1.GetMissingPatientsUseCase);
        getRecentClaimsUseCase = module.get(get_recent_claims_use_case_1.GetRecentClaimsUseCase);
    });
    it('deve permitir acesso ao overview para usuários com role doctor', async () => {
        await expect(controller.getOverview(mockDoctor)).resolves.not.toThrow();
        expect(getClinicOverviewUseCase.execute).toHaveBeenCalledWith(mockDoctor.tenantId);
    });
    it('deve lançar ForbiddenException se um patient tentar acessar o overview', async () => {
        await expect(controller.getOverview(mockPatient)).rejects.toThrow(common_1.ForbiddenException);
    });
    it('deve permitir acesso a pacientes inativos apenas para médicos/admins', async () => {
        await expect(controller.getInactive(mockDoctor)).resolves.not.toThrow();
        expect(getMissingPatientsUseCase.execute).toHaveBeenCalledWith(mockDoctor.tenantId);
    });
    it('deve bloquear acesso a resgates recentes para pacientes', async () => {
        await expect(controller.getRecentClaims(mockPatient)).rejects.toThrow(common_1.ForbiddenException);
    });
    it('deve buscar os resgates recentes pelo tenantId do médico logado', async () => {
        await controller.getRecentClaims(mockDoctor);
        expect(getRecentClaimsUseCase.execute).toHaveBeenCalledWith(mockDoctor.tenantId);
    });
});
//# sourceMappingURL=dashboard.controller.spec.js.map