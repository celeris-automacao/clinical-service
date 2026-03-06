import { Test, TestingModule } from '@nestjs/testing';
import { RecordsService } from '../../records/records.service';
import { IRecordsRepository } from '../../records/repositories/interfaces/records.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../../achievements/achievements.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('RecordsService - Evolution & Ranking', () => {
  let service: RecordsService;
  let repository: IRecordsRepository; // Tipar com a Interface

  const mockUser = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'patient'
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsService,
        {
          // MUDANÇA: Usar o Token em string
          provide: 'IRecordsRepository',
          useValue: {
            findAllByPatient: jest.fn(),
            findLastTwo: jest.fn(),
          },
        },
        { provide: PrismaService, useValue: { bossBattle: { updateMany: jest.fn() }, playerStats: { update: jest.fn() } } },
        { provide: AchievementsService, useValue: { checkLevelAchievements: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<RecordsService>(RecordsService);
    repository = module.get<IRecordsRepository>('IRecordsRepository');
  });

  it('deve calcular corretamente o dano total acumulado (12kg = 92.400 kcal)', async () => {
    const history = [
      { weight: 100 },
      { weight: 90 }, // -10kg
      { weight: 95 }, // +5kg (ignora)
      { weight: 93 }, // -2kg
    ];

    jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history as any);

    const stats = await service.getStats(mockUser as any);

    expect(stats.totalWeightLoss).toBe(12);
    expect(stats.totalDamage).toBe(92400);
  });

  it('deve atribuir o Rank "Guerreiro de Elite" para danos acima de 50.000', async () => {
    const history = [{ weight: 100 }, { weight: 90 }]; // 10kg = 77.000 kcal  
    jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history as any);

    const stats = await service.getStats(mockUser as any);
    expect(stats.rank).toBe('Guerreiro de Elite');
  });

  it('deve calcular o progresso de nível corretamente', async () => {
    // 7700 de dano deve colocar o usuário no nível correspondente [cite: 518, 522]
    const history = [{ weight: 81 }, { weight: 80 }];
    jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history as any);

    const stats = await service.getStats(mockUser as any);

    expect(stats.currentLevel).toBeGreaterThanOrEqual(1);
    expect(stats.progressPercentage).toBeDefined();
  });
});