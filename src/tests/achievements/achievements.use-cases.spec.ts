import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CheckLevelAchievementsUseCase } from '../../achievements/application/use-cases/check-level-achievements.use-case';
import { EmitGlobalVictoryUseCase } from '../../achievements/application/use-cases/emit-global-victory.use-case';
import { AchievementsEventsPort } from '../../achievements/application/ports/achievements-events.port';
import {
  ACHIEVEMENTS_EVENTS_PORT,
  ACHIEVEMENTS_REPOSITORY,
} from '../../achievements/achievements.tokens';
import { IAchievementsRepository } from '../../achievements/application/ports/achievements-repository.port';

describe('Achievements Use Cases', () => {
  let repository: IAchievementsRepository;
  let eventsPort: AchievementsEventsPort;
  let checkLevelAchievementsUseCase: CheckLevelAchievementsUseCase;
  let emitGlobalVictoryUseCase: EmitGlobalVictoryUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckLevelAchievementsUseCase,
        EmitGlobalVictoryUseCase,
        {
          provide: ACHIEVEMENTS_REPOSITORY,
          useValue: {
            getOrCreateBadge: jest.fn(),
            findClaim: jest.fn(),
            createClaim: jest.fn(),
          },
        },
        {
          provide: ACHIEVEMENTS_EVENTS_PORT,
          useValue: {
            emitAchievementUnlocked: jest.fn().mockResolvedValue(undefined),
            emitBossDefeatedGlobal: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    repository = module.get<IAchievementsRepository>(ACHIEVEMENTS_REPOSITORY);
    eventsPort = module.get<AchievementsEventsPort>(ACHIEVEMENTS_EVENTS_PORT);
    checkLevelAchievementsUseCase = module.get<CheckLevelAchievementsUseCase>(
      CheckLevelAchievementsUseCase,
    );
    emitGlobalVictoryUseCase = module.get<EmitGlobalVictoryUseCase>(EmitGlobalVictoryUseCase);
  });

  it('não deve fazer nada se o nível não tiver conquista mapeada', async () => {
    await checkLevelAchievementsUseCase.execute({
      patientId: 'p1',
      tenantId: 't1',
      newLevel: 3,
    });

    expect(repository.getOrCreateBadge).not.toHaveBeenCalled();
    expect(eventsPort.emitAchievementUnlocked).not.toHaveBeenCalled();
  });

  it('deve criar uma conquista e emitir evento se for um nível válido e não possuir a medalha', async () => {
    (repository.getOrCreateBadge as jest.Mock).mockResolvedValue({
      id: 'r2',
      title: 'Medalha de Nível 2',
    });
    (repository.findClaim as jest.Mock).mockResolvedValue(null);

    await checkLevelAchievementsUseCase.execute({
      patientId: 'p1',
      tenantId: 't1',
      newLevel: 2,
    });

    expect(repository.getOrCreateBadge).toHaveBeenCalledWith('t1', 'Medalha de Nível 2', 'award');
    expect(repository.createClaim).toHaveBeenCalledWith('p1', 't1', 'r2');
    expect(eventsPort.emitAchievementUnlocked).toHaveBeenCalledWith({
      patientId: 'p1',
      tenantId: 't1',
      achievement: 'Medalha de Nível 2',
    });
  });

  it('não deve criar duplicidade se o paciente já possuir a conquista', async () => {
    (repository.getOrCreateBadge as jest.Mock).mockResolvedValue({
      id: 'r5',
      title: 'Guerreiro de Elite',
    });
    (repository.findClaim as jest.Mock).mockResolvedValue({ id: 'claim-1' });

    await checkLevelAchievementsUseCase.execute({
      patientId: 'p1',
      tenantId: 't1',
      newLevel: 5,
    });

    expect(repository.createClaim).not.toHaveBeenCalled();
    expect(eventsPort.emitAchievementUnlocked).not.toHaveBeenCalled();
  });

  it('deve emitir vitória global com timestamp', async () => {
    await emitGlobalVictoryUseCase.execute({
      tenantId: 't1',
      message: 'Boss derrotado',
    });

    expect(eventsPort.emitBossDefeatedGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        message: 'Boss derrotado',
        timestamp: expect.any(Date),
      }),
    );
  });
});
