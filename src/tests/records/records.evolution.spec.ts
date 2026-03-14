import { Test, TestingModule } from '@nestjs/testing';
import { GetPatientStatsUseCase } from '../../records/application/use-cases/get-patient-stats.use-case';
import { ClinicalProgressCalculator } from '../../records/domain/services/clinical-progress-calculator';
import { IRecordsRepository } from '../../records/repositories/interfaces/records.repository.interface';
import { RECORDS_REPOSITORY } from '../../records/records.tokens';

describe('GetPatientStatsUseCase - Evolution & Ranking', () => {
  let useCase: GetPatientStatsUseCase;
  let repository: IRecordsRepository;

  const mockUser = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'patient',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPatientStatsUseCase,
        ClinicalProgressCalculator,
        {
          provide: RECORDS_REPOSITORY,
          useValue: {
            findAllByPatient: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetPatientStatsUseCase>(GetPatientStatsUseCase);
    repository = module.get<IRecordsRepository>(RECORDS_REPOSITORY);
  });

  it('deve calcular corretamente o dano total acumulado (12kg = 92.400 kcal)', async () => {
    const history = [
      { weight: 100 },
      { weight: 90 },
      { weight: 95 },
      { weight: 93 },
    ];

    jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history as any);

    const stats = await useCase.execute(mockUser as any);

    expect(stats.totalWeightLoss).toBe(12);
    expect(stats.totalDamage).toBe(92400);
  });

  it('deve atribuir o rank "Guerreiro de Elite" para danos acima de 50.000', async () => {
    const history = [{ weight: 100 }, { weight: 90 }];
    jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history as any);

    const stats = await useCase.execute(mockUser as any);

    expect(stats.rank).toBe('Guerreiro de Elite');
  });

  it('deve calcular o progresso de nivel corretamente', async () => {
    const history = [{ weight: 81 }, { weight: 80 }];
    jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history as any);

    const stats = await useCase.execute(mockUser as any);

    expect(stats.currentLevel).toBeGreaterThanOrEqual(1);
    expect(stats.progressPercentage).toBeDefined();
  });
});
