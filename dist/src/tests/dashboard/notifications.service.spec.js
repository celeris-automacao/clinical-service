"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const notifications_service_1 = require("../../dashboard/notifications.service");
const notifications_repository_1 = require("../../dashboard/repositories/notifications.repository");
describe('NotificationsService - Event Reactions', () => {
    let service;
    let repository;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                notifications_service_1.NotificationsService,
                {
                    provide: notifications_repository_1.NotificationsRepository,
                    useValue: {
                        createNotification: jest.fn().mockResolvedValue({ id: 'notif-123' }),
                    },
                },
            ],
        }).compile();
        service = module.get(notifications_service_1.NotificationsService);
        repository = module.get(notifications_repository_1.NotificationsRepository);
    });
    describe('handleAchievement', () => {
        it('deve formatar e persistir uma notificação quando uma conquista for desbloqueada', async () => {
            const mockPayload = {
                patientId: 'user-123',
                tenantId: 'tenant-456',
                achievement: 'Guerreiro de Elite'
            };
            await service.handleAchievement(mockPayload);
            expect(repository.createNotification).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user-123',
                tenantId: 'tenant-456',
                title: '🏆 NOVA CONQUISTA!',
                type: 'achievement'
            }));
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
            expect(repository.createNotification).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user-789',
                tenantId: 'tenant-456',
                title: '📢 VITÓRIA ÉPICA!',
                type: 'boss_defeat'
            }));
        });
    });
});
//# sourceMappingURL=notifications.service.spec.js.map