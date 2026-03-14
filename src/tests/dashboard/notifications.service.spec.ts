import { Test, TestingModule } from '@nestjs/testing';
import {
  APPLICATION_EVENTS,
  createApplicationEvent,
} from '../../shared/application/events/application-events';
import { NotificationsRepositoryPort } from '../../dashboard/application/ports/notifications-repository.port';
import { NOTIFICATIONS_REPOSITORY } from '../../dashboard/dashboard.tokens';
import { NotificationsService } from '../../dashboard/presentation/listeners/notifications.service';

describe('NotificationsService - Event Reactions', () => {
  let service: NotificationsService;
  let repository: NotificationsRepositoryPort;

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
    repository = module.get<NotificationsRepositoryPort>(NOTIFICATIONS_REPOSITORY);
  });

  it('deve formatar e persistir uma notificacao quando uma conquista for desbloqueada', async () => {
    await service.handleAchievement(
      createApplicationEvent(APPLICATION_EVENTS.achievementUnlocked, {
        patientId: 'user-123',
        tenantId: 'tenant-456',
        achievement: 'Guerreiro de Elite',
      }),
    );

    expect(repository.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        tenantId: 'tenant-456',
        title: 'NOVA CONQUISTA!',
        type: 'achievement',
      }),
    );
  });

  it('deve formatar uma notificacao epica quando um boss for derrotado', async () => {
    await service.handleBossDefeated(
      createApplicationEvent(APPLICATION_EVENTS.bossDefeated, {
        tenantId: 'tenant-456',
        bossId: 'boss-1',
        bossName: 'Dragao de Calorias',
        killerId: 'user-789',
      }),
    );

    expect(repository.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-789',
        tenantId: 'tenant-456',
        title: 'VITORIA EPICA!',
        type: 'boss_defeat',
      }),
    );
  });
});
