"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const dashboard_controller_1 = require("../../dashboard/dashboard.controller");
const dashboard_service_1 = require("../../dashboard/dashboard.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
const common_1 = require("@nestjs/common");
describe('DashboardController', () => {
    let controller;
    let dashboardService;
    let prisma;
    const mockDoctor = { userId: 'd1', tenantId: 't1', role: 'doctor' };
    const mockPatient = { userId: 'p1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [dashboard_controller_1.DashboardController],
            providers: [
                {
                    provide: dashboard_service_1.DashboardService,
                    useValue: {
                        getClinicOverview: jest.fn().mockResolvedValue({}),
                        getMissingPatients: jest.fn().mockResolvedValue([]),
                    },
                },
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        rewardClaim: { findMany: jest.fn().mockResolvedValue([]) },
                    },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(dashboard_controller_1.DashboardController);
        dashboardService = module.get(dashboard_service_1.DashboardService);
        prisma = module.get(prisma_service_1.PrismaService);
    });
    describe('Segurança e Permissões (RBAC)', () => {
        it('deve permitir acesso ao overview para usuários com role "doctor"', async () => {
            await expect(controller.getOverview(mockDoctor)).resolves.not.toThrow();
            expect(dashboardService.getClinicOverview).toHaveBeenCalledWith(mockDoctor.tenantId);
        });
        it('deve lançar ForbiddenException se um "patient" tentar acessar o overview', async () => {
            await expect(controller.getOverview(mockPatient)).rejects.toThrow(common_1.ForbiddenException);
        });
        it('deve permitir acesso a pacientes inativos apenas para médicos/admins', async () => {
            await expect(controller.getInactive(mockDoctor)).resolves.not.toThrow();
            expect(dashboardService.getMissingPatients).toHaveBeenCalledWith(mockDoctor.tenantId);
        });
        it('deve bloquear acesso a resgates recentes para pacientes', async () => {
            await expect(controller.getRecentClaims(mockPatient)).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('getRecentClaims', () => {
        it('deve filtrar os resgates pelo tenantId do médico logado', async () => {
            await controller.getRecentClaims(mockDoctor);
            expect(prisma.rewardClaim.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { tenantId: mockDoctor.tenantId }
            }));
        });
    });
});
//# sourceMappingURL=dashboard.controller.spec.js.map