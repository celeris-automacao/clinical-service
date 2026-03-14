import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DashboardController } from '../../dashboard/presentation/http/dashboard.controller';
import { GetClinicOverviewUseCase } from '../../dashboard/application/use-cases/get-clinic-overview.use-case';
import { GetMissingPatientsUseCase } from '../../dashboard/application/use-cases/get-missing-patients.use-case';
import { GetRecentClaimsUseCase } from '../../dashboard/application/use-cases/get-recent-claims.use-case';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { UserContext } from '../../shared/auth/user-context';

describe('DashboardController', () => {
  let controller: DashboardController;
  let getClinicOverviewUseCase: GetClinicOverviewUseCase;
  let getMissingPatientsUseCase: GetMissingPatientsUseCase;
  let getRecentClaimsUseCase: GetRecentClaimsUseCase;

  const mockDoctor: UserContext = { userId: 'd1', tenantId: 't1', role: 'doctor' };
  const mockPatient: UserContext = { userId: 'p1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: GetClinicOverviewUseCase,
          useValue: { execute: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: GetMissingPatientsUseCase,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: GetRecentClaimsUseCase,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    getClinicOverviewUseCase = module.get<GetClinicOverviewUseCase>(GetClinicOverviewUseCase);
    getMissingPatientsUseCase = module.get<GetMissingPatientsUseCase>(GetMissingPatientsUseCase);
    getRecentClaimsUseCase = module.get<GetRecentClaimsUseCase>(GetRecentClaimsUseCase);
  });

  it('deve permitir acesso ao overview para usuários com role doctor', async () => {
    await expect(controller.getOverview(mockDoctor)).resolves.not.toThrow();
    expect(getClinicOverviewUseCase.execute).toHaveBeenCalledWith(mockDoctor.tenantId);
  });

  it('deve lançar ForbiddenException se um patient tentar acessar o overview', async () => {
    await expect(controller.getOverview(mockPatient)).rejects.toThrow(ForbiddenException);
  });

  it('deve permitir acesso a pacientes inativos apenas para médicos/admins', async () => {
    await expect(controller.getInactive(mockDoctor)).resolves.not.toThrow();
    expect(getMissingPatientsUseCase.execute).toHaveBeenCalledWith(mockDoctor.tenantId);
  });

  it('deve bloquear acesso a resgates recentes para pacientes', async () => {
    await expect(controller.getRecentClaims(mockPatient)).rejects.toThrow(ForbiddenException);
  });

  it('deve buscar os resgates recentes pelo tenantId do médico logado', async () => {
    await controller.getRecentClaims(mockDoctor);
    expect(getRecentClaimsUseCase.execute).toHaveBeenCalledWith(mockDoctor.tenantId);
  });
});
