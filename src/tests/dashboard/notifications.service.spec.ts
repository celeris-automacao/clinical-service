import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../../dashboard/presentation/listeners/notifications.service';
import { INotificationsRepository } from '../../dashboard/repositories/interfaces/notifications.repository.interface';
import { NOTIFICATIONS_REPOSITORY } from '../../dashboard/dashboard.tokens';

describe('NotificationsService - Event Reactions', () => {
  let service: NotificationsService;
  let repository: INotificationsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: NOTIFICATIONS_REPOSITORY,
          useValue: {
            createNotification: jest.fn().mockResolvedValue({ id: 'notif-123' }),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = module.get<INotificationsRepository>(NOTIFICATIONS_REPOSITORY);
  });

  describe('handleAchievement', () => {
    it('deve formatar e persistir uma notificação quando uma conquista for desbloqueada', async () => {
      const mockPayload = {
        patientId: 'user-123',
        tenantId: 'tenant-456',
        achievement: 'Guerreiro de Elite'
      };

      await service.handleAchievement(mockPayload);

      // Verifica se o repositório foi chamado com os dados formatados corretamente
      expect(repository.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          tenantId: 'tenant-456',
          title: '🏆 NOVA CONQUISTA!',
          type: 'achievement'
        })
      );
    });
  });

  describe('handleBossDefeated', () => {
    it('deve formatar uma notificação épica quando um Boss for derrotado', async () => {
      const mockPayload = {
        tenantId: 'tenant-456',
        bossName: 'Dragão de Calorias',
        killerId: 'user-789'
      };

      await service.handleBossDefeated(mockPayload);

      expect(repository.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-789',
          tenantId: 'tenant-456',
          title: '📢 VITÓRIA ÉPICA!',
          type: 'boss_defeat'
        })
      );
    });
  });
});
