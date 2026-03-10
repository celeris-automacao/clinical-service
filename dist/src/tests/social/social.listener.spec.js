"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const social_listener_1 = require("../../social/social.listener");
const social_service_1 = require("../../social/social.service");
describe('SocialListener', () => {
    let listener;
    let socialService;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                social_listener_1.SocialListener,
                {
                    provide: social_service_1.SocialService,
                    useValue: {
                        createPost: jest.fn(),
                    },
                },
            ],
        }).compile();
        listener = module.get(social_listener_1.SocialListener);
        socialService = module.get(social_service_1.SocialService);
    });
    it('deve criar um post automático quando um Boss for derrotado', async () => {
        const payload = {
            killerId: 'u1',
            tenantId: 't1',
            bossName: 'Dragão de Açúcar'
        };
        await listener.handleBossDefeated(payload);
        expect(socialService.createPost).toHaveBeenCalledWith('u1', 't1', expect.stringContaining('Dragão de Açúcar'), 'boss_defeat');
    });
    it('deve criar um post automático quando uma conquista for desbloqueada', async () => {
        const payload = {
            patientId: 'u2',
            tenantId: 't1',
            achievement: 'Maratonista'
        };
        await listener.handleAchievement(payload);
        expect(socialService.createPost).toHaveBeenCalledWith('u2', 't1', expect.stringContaining('Maratonista'), 'achievement');
    });
});
//# sourceMappingURL=social.listener.spec.js.map