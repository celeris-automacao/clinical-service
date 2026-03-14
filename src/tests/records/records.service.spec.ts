import { Test, TestingModule } from '@nestjs/testing';
import { CreateClinicalRecordUseCase } from '../../records/application/use-cases/create-clinical-record.use-case';
import { GetPatientEvolutionUseCase } from '../../records/application/use-cases/get-patient-evolution.use-case';
import { GetPatientStatsUseCase } from '../../records/application/use-cases/get-patient-stats.use-case';
import { HandleBossVictoryUseCase } from '../../records/application/use-cases/handle-boss-victory.use-case';
import { RecordsService } from '../../records/records.service';

describe('RecordsService', () => {
  let service: RecordsService;
  let createClinicalRecordUseCase: CreateClinicalRecordUseCase;
  let getPatientStatsUseCase: GetPatientStatsUseCase;
  let getPatientEvolutionUseCase: GetPatientEvolutionUseCase;
  let handleBossVictoryUseCase: HandleBossVictoryUseCase;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsService,
        {
          provide: CreateClinicalRecordUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: GetPatientStatsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: GetPatientEvolutionUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: HandleBossVictoryUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecordsService>(RecordsService);
    createClinicalRecordUseCase = module.get<CreateClinicalRecordUseCase>(CreateClinicalRecordUseCase);
    getPatientStatsUseCase = module.get<GetPatientStatsUseCase>(GetPatientStatsUseCase);
    getPatientEvolutionUseCase = module.get<GetPatientEvolutionUseCase>(GetPatientEvolutionUseCase);
    handleBossVictoryUseCase = module.get<HandleBossVictoryUseCase>(HandleBossVictoryUseCase);
  });

  it('deve delegar createRecord para o use case de criacao', async () => {
    const dto = { weight: 80 };

    await service.createRecord(dto as any, mockUser as any);

    expect(createClinicalRecordUseCase.execute).toHaveBeenCalledWith(dto, mockUser);
  });

  it('deve delegar getStats para o use case de estatisticas', async () => {
    await service.getStats(mockUser as any);

    expect(getPatientStatsUseCase.execute).toHaveBeenCalledWith(mockUser);
  });

  it('deve delegar getEvolution para o use case de evolucao', async () => {
    await service.getEvolution(mockUser as any);

    expect(getPatientEvolutionUseCase.execute).toHaveBeenCalledWith(mockUser);
  });

  it('deve delegar handleBossVictory para o use case dedicado', async () => {
    await service.handleBossVictory('boss-1', 'tenant-1');

    expect(handleBossVictoryUseCase.execute).toHaveBeenCalledWith('boss-1', 'tenant-1');
  });
});
