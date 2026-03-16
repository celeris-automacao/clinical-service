"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const application_events_1 = require("../../shared/application/events/application-events");
const dashboard_tokens_1 = require("../../dashboard/dashboard.tokens");
const notifications_service_1 = require("../../dashboard/presentation/listeners/notifications.service");
describe('NotificationsService - Event Reactions', () => {
    let service;
    let repository;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                notifications_service_1.NotificationsService,
                {
                    provide: dashboard_tokens_1.NOTIFICATIONS_REPOSITORY,
                    useValue: {
                        createNotification: jest.fn().mockResolvedValue({ id: 'notif-123' }),
                    },
                },
            ],
        }).compile();
        service = module.get(notifications_service_1.NotificationsService);
        repository = module.get(dashboard_tokens_1.NOTIFICATIONS_REPOSITORY);
    });
    it('deve formatar e persistir uma notificacao quando uma conquista for desbloqueada', async () => {
        await service.handleAchievement((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.achievementUnlocked, {
            patientId: 'user-123',
            tenantId: 'tenant-456',
            achievement: 'Guerreiro de Elite',
        }));
        expect(repository.createNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-123',
            tenantId: 'tenant-456',
            title: 'NOVA CONQUISTA!',
            type: 'achievement',
        }));
    });
    it('deve formatar uma notificacao epica quando um boss for derrotado', async () => {
        await service.handleBossDefeated((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.bossDefeated, {
            tenantId: 'tenant-456',
            bossId: 'boss-1',
            bossName: 'Dragao de Calorias',
            killerId: 'user-789',
        }));
        expect(repository.createNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-789',
            tenantId: 'tenant-456',
            title: 'VITORIA EPICA!',
            type: 'boss_defeat',
        }));
    });
});
//# sourceMappingURL=notifications.service.spec.js.map