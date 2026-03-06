import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from '../../dashboard/dashboard.controller';
import { DashboardService } from '../../dashboard/dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { ForbiddenException } from '@nestjs/common';
import { UserContext } from '../../common/decorators/get-user.decorator';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: DashboardService;
  let prisma: PrismaService;

  // Mocks de contexto para diferentes permissões
  const mockDoctor: UserContext = { userId: 'd1', tenantId: 't1', role: 'doctor' };
  const mockPatient: UserContext = { userId: 'p1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getClinicOverview: jest.fn().mockResolvedValue({}),
            getMissingPatients: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            rewardClaim: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true }) // Simula bypass de autenticação JWT
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    dashboardService = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Segurança e Permissões (RBAC)', () => {
    it('deve permitir acesso ao overview para usuários com role "doctor"', async () => {
      await expect(controller.getOverview(mockDoctor)).resolves.not.toThrow();
      expect(dashboardService.getClinicOverview).toHaveBeenCalledWith(mockDoctor.tenantId);
    });

    it('deve lançar ForbiddenException se um "patient" tentar acessar o overview', async () => {
      await expect(controller.getOverview(mockPatient)).rejects.toThrow(ForbiddenException);
    });

    it('deve permitir acesso a pacientes inativos apenas para médicos/admins', async () => {
      await expect(controller.getInactive(mockDoctor)).resolves.not.toThrow();
      expect(dashboardService.getMissingPatients).toHaveBeenCalledWith(mockDoctor.tenantId);
    });

    it('deve bloquear acesso a resgates recentes para pacientes', async () => {
      await expect(controller.getRecentClaims(mockPatient)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRecentClaims', () => {
    it('deve filtrar os resgates pelo tenantId do médico logado', async () => {
      await controller.getRecentClaims(mockDoctor);
      
      expect(prisma.rewardClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: mockDoctor.tenantId }
        })
      );
    });
  });
});