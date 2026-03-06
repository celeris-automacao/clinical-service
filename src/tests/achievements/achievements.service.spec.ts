import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from '../../achievements/achievements.service';
import { IAchievementsRepository } from '../../achievements/repositories/interfaces/achievements.repository.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let repository: IAchievementsRepository;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        {
          provide: 'IAchievementsRepository',
          useValue: {
            getOrCreateBadge: jest.fn(),
            findClaim: jest.fn(),
            createClaim: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
    repository = module.get<IAchievementsRepository>('IAchievementsRepository');
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('checkLevelAchievements', () => {
    const patientId = 'p1';
    const tenantId = 't1';

    it('não deve fazer nada se o nível não tiver conquista mapeada', async () => {
      await service.checkLevelAchievements(patientId, tenantId, 3); // Nível 3 não tem medalha

      expect(repository.getOrCreateBadge).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('deve criar uma conquista e emitir evento se for um nível válido e não possuir a medalha', async () => {
      const mockReward = { id: 'r2', title: 'Medalha de Nível 2' };
      
      (repository.getOrCreateBadge as jest.Mock).mockResolvedValue(mockReward);
      (repository.findClaim as jest.Mock).mockResolvedValue(null); // Não possui

      await service.checkLevelAchievements(patientId, tenantId, 2);

      expect(repository.getOrCreateBadge).toHaveBeenCalledWith(tenantId, 'Medalha de Nível 2', 'award');
      expect(repository.createClaim).toHaveBeenCalledWith(patientId, tenantId, 'r2');
      expect(eventEmitter.emit).toHaveBeenCalledWith('achievement.unlocked', {
        patientId,
        tenantId,
        achievement: 'Medalha de Nível 2'
      });
    });

    it('não deve criar duplicidade se o paciente já possuir a conquista', async () => {
      const mockReward = { id: 'r5', title: 'Guerreiro de Elite' };
      
      (repository.getOrCreateBadge as jest.Mock).mockResolvedValue(mockReward);
      (repository.findClaim as jest.Mock).mockResolvedValue({ id: 'claim1' }); // Já possui

      await service.checkLevelAchievements(patientId, tenantId, 5);

      expect(repository.createClaim).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});