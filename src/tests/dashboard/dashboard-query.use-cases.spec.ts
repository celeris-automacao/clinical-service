import { Test, TestingModule } from '@nestjs/testing';
import { GetClinicOverviewUseCase } from '../../dashboard/application/use-cases/get-clinic-overview.use-case';
import { GetMissingPatientsUseCase } from '../../dashboard/application/use-cases/get-missing-patients.use-case';
import { GetRecentClaimsUseCase } from '../../dashboard/application/use-cases/get-recent-claims.use-case';
import { DASHBOARD_REPOSITORY } from '../../dashboard/dashboard.tokens';
import { IDashboardRepository } from '../../dashboard/application/ports/dashboard-repository.port';

describe('Dashboard Query Use Cases', () => {
  let repository: IDashboardRepository;
  let getClinicOverviewUseCase: GetClinicOverviewUseCase;
  let getMissingPatientsUseCase: GetMissingPatientsUseCase;
  let getRecentClaimsUseCase: GetRecentClaimsUseCase;
  const mockTenantId = 'tenant-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetClinicOverviewUseCase,
        GetMissingPatientsUseCase,
        GetRecentClaimsUseCase,
        {
          provide: DASHBOARD_REPOSITORY,
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

    repository = module.get<IDashboardRepository>(DASHBOARD_REPOSITORY);
    getClinicOverviewUseCase = module.get<GetClinicOverviewUseCase>(GetClinicOverviewUseCase);
    getMissingPatientsUseCase = module.get<GetMissingPatientsUseCase>(GetMissingPatientsUseCase);
    getRecentClaimsUseCase = module.get<GetRecentClaimsUseCase>(GetRecentClaimsUseCase);
  });

  it('deve retornar zeros e listas vazias quando não houver dados na clínica', async () => {
    (repository.countActivePlayers as jest.Mock).mockResolvedValue(0);
    (repository.findRecentAchievements as jest.Mock).mockResolvedValue([]);
    (repository.findTopPlayers as jest.Mock).mockResolvedValue([]);

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

    (repository.getTaskCompletionsHistory as jest.Mock).mockResolvedValue([
      { patientId: 'p1', completedAt: yesterday },
      { patientId: 'p1', completedAt: tenDaysAgo },
    ]);

    const result = await getMissingPatientsUseCase.execute(mockTenantId, 3);

    expect(result).toHaveLength(0);
  });

  it('deve respeitar o parâmetro customizado de dias de inatividade', async () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(new Date().getDate() - 5);

    (repository.getTaskCompletionsHistory as jest.Mock).mockResolvedValue([
      { patientId: 'p2', completedAt: fiveDaysAgo },
    ]);

    const resultAtivo = await getMissingPatientsUseCase.execute(mockTenantId, 7);
    expect(resultAtivo).toHaveLength(0);

    const resultInativo = await getMissingPatientsUseCase.execute(mockTenantId, 3);
    expect(resultInativo).toHaveLength(1);
  });

  it('deve retornar lista vazia se ninguém tiver completado tarefas na clínica', async () => {
    (repository.getTaskCompletionsHistory as jest.Mock).mockResolvedValue([]);

    const result = await getMissingPatientsUseCase.execute(mockTenantId);
    expect(result).toEqual([]);
  });

  it('deve buscar os resgates recentes limitando em 10 por tenant', async () => {
    const claims = [{ id: 'claim-1' }];
    (repository.findRecentClaims as jest.Mock).mockResolvedValue(claims);

    const result = await getRecentClaimsUseCase.execute(mockTenantId);

    expect(repository.findRecentClaims).toHaveBeenCalledWith(mockTenantId, 10);
    expect(result).toEqual(claims);
  });
});
