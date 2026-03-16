import { Test, TestingModule } from '@nestjs/testing';
import { GetPlayerStatsUseCase } from '../../game/application/use-cases/get-player-stats.use-case';
import { GameRepositoryPort } from '../../game/application/ports/game-repository.port';
import { PlayerClinicalStatsPort } from '../../game/application/ports/player-clinical-stats.port';
import { GAME_REPOSITORY, PLAYER_CLINICAL_STATS_PORT } from '../../game/game.tokens';

describe('GetPlayerStatsUseCase', () => {
  let useCase: GetPlayerStatsUseCase;
  let repository: GameRepositoryPort;
  let playerClinicalStatsPort: PlayerClinicalStatsPort;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPlayerStatsUseCase,
        {
          provide: GAME_REPOSITORY,
          useValue: {
            findPlayerProgress: jest.fn(),
            findActiveBoss: jest.fn(),
          },
        },
        {
          provide: PLAYER_CLINICAL_STATS_PORT,
          useValue: { getStats: jest.fn() },
        },
      ],
    }).compile();

    useCase = module.get<GetPlayerStatsUseCase>(GetPlayerStatsUseCase);
    repository = module.get<GameRepositoryPort>(GAME_REPOSITORY);
    playerClinicalStatsPort = module.get<PlayerClinicalStatsPort>(PLAYER_CLINICAL_STATS_PORT);
  });

  it('deve consolidar nivel, XP e status do boss com precisao', async () => {
    (playerClinicalStatsPort.getStats as jest.Mock).mockResolvedValue({ totalDamage: 5000 });
    (repository.findPlayerProgress as jest.Mock).mockResolvedValue({
      currentLevel: 5,
      currentXp: 450,
    });
    (repository.findActiveBoss as jest.Mock).mockResolvedValue({
      name: 'Dragao de Acucar',
      currentHp: { toNumber: () => 500 },
      maxHp: { toNumber: () => 1000 },
    });

    const stats = await useCase.execute(mockUser as any);

    expect(repository.findPlayerProgress).toHaveBeenCalledWith('u1', 't1');
    expect(stats.level).toBe(5);
    expect(stats.nextLevelXp).toBe(5000);
    expect(stats.totalDamageDealt).toBe(5000);
    expect(stats.boss).toEqual({
      name: 'Dragao de Acucar',
      hpPercentage: 50,
      currentHp: 500,
    });
  });

  it('deve retornar valores iniciais seguros se o jogador nao tiver dados', async () => {
    (playerClinicalStatsPort.getStats as jest.Mock).mockResolvedValue({ totalDamage: 0 });
    (repository.findPlayerProgress as jest.Mock).mockResolvedValue(null);
    (repository.findActiveBoss as jest.Mock).mockResolvedValue(null);

    const stats = await useCase.execute(mockUser as any);

    expect(repository.findPlayerProgress).toHaveBeenCalledWith('u1', 't1');
    expect(stats.level).toBe(1);
    expect(stats.currentXp).toBe(0);
    expect(stats.boss).toBeNull();
  });
});
