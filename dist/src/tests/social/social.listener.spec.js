"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const application_events_1 = require("../../shared/application/events/application-events");
const create_social_post_use_case_1 = require("../../social/application/use-cases/create-social-post.use-case");
const social_listener_1 = require("../../social/presentation/listeners/social.listener");
describe('SocialListener', () => {
    let listener;
    let createSocialPostUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                social_listener_1.SocialListener,
                {
                    provide: create_social_post_use_case_1.CreateSocialPostUseCase,
                    useValue: {
                        execute: jest.fn(),
                    },
                },
            ],
        }).compile();
        listener = module.get(social_listener_1.SocialListener);
        createSocialPostUseCase = module.get(create_social_post_use_case_1.CreateSocialPostUseCase);
    });
    it('deve criar um post automatico quando um boss for derrotado', async () => {
        await listener.handleBossDefeated((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.bossDefeated, {
            killerId: 'u1',
            tenantId: 't1',
            bossId: 'boss-1',
            bossName: 'Dragao de Acucar',
        }));
        expect(createSocialPostUseCase.execute).toHaveBeenCalledWith({
            patientId: 'u1',
            tenantId: 't1',
            content: expect.stringContaining('Dragao de Acucar'),
            type: 'boss_defeat',
        });
    });
    it('deve criar um post automatico quando uma conquista for desbloqueada', async () => {
        await listener.handleAchievement((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.achievementUnlocked, {
            patientId: 'u2',
            tenantId: 't1',
            achievement: 'Maratonista',
        }));
        expect(createSocialPostUseCase.execute).toHaveBeenCalledWith({
            patientId: 'u2',
            tenantId: 't1',
            content: expect.stringContaining('Maratonista'),
            type: 'achievement',
        });
    });
});
//# sourceMappingURL=social.listener.spec.js.map