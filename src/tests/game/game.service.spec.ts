// src/tests/game/game.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from '../../game/game.service';
import { IGameRepository } from '../../game/repositories/interfaces/game.repository.interface';
import { RecordsService } from '../../records/records.service';

describe('GameService', () => {
  let service: GameService;
  let repository: IGameRepository;
  let recordsService: RecordsService;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: 'IGameRepository',
          useValue: {
            findPlayerProgress: jest.fn(),
            findActiveBoss: jest.fn(),
          },
        },
        {
          provide: RecordsService,
          useValue: { getStats: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    repository = module.get<IGameRepository>('IGameRepository');
    recordsService = module.get<RecordsService>(RecordsService);
  });

  describe('getPlayerStats', () => {
    it('deve consolidar nível, XP e status do Boss com precisão', async () => {
      // Mock do dano total (RecordsService)
      (recordsService.getStats as jest.Mock).mockResolvedValue({ totalDamage: 5000 });

      // Mock do progresso do jogador (Repository)
      (repository.findPlayerProgress as jest.Mock).mockResolvedValue({
        currentLevel: 5,
        currentXp: 450,
      });

      // Mock do Boss ativo (Repository)
      (repository.findActiveBoss as jest.Mock).mockResolvedValue({
        name: 'Dragão de Açúcar',
        currentHp: { toNumber: () => 500 },
        maxHp: { toNumber: () => 1000 },
      });

      const stats = await service.getPlayerStats(mockUser as any);

      expect(stats.level).toBe(5);
      expect(stats.nextLevelXp).toBe(5000); // Nível 5 * 1000
      expect(stats.totalDamageDealt).toBe(5000);
      expect(stats.boss).toEqual({
        name: 'Dragão de Açúcar',
        hpPercentage: 50,
        currentHp: 500,
      });
    });

    it('deve retornar valores iniciais seguros se o jogador não tiver dados', async () => {
      (recordsService.getStats as jest.Mock).mockResolvedValue({ totalDamage: 0 });
      (repository.findPlayerProgress as jest.Mock).mockResolvedValue(null);
      (repository.findActiveBoss as jest.Mock).mockResolvedValue(null);

      const stats = await service.getPlayerStats(mockUser as any);

      expect(stats.level).toBe(1);
      expect(stats.currentXp).toBe(0);
      expect(stats.boss).toBeNull();
    });
  });
});