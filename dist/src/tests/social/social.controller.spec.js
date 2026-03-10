"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const social_controller_1 = require("../../social/social.controller");
const social_service_1 = require("../../social/social.service");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
describe('SocialController', () => {
    let controller;
    let service;
    const mockUser = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        role: 'patient'
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [social_controller_1.SocialController],
            providers: [
                {
                    provide: social_service_1.SocialService,
                    useValue: {
                        getFeed: jest.fn().mockResolvedValue([{ id: '1', content: 'Post épico!' }]),
                    },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(social_controller_1.SocialController);
        service = module.get(social_service_1.SocialService);
    });
    describe('getFeed', () => {
        it('deve chamar o service.getFeed com o tenantId do usuário logado', async () => {
            const result = await controller.getFeed(mockUser);
            expect(service.getFeed).toHaveBeenCalledWith(mockUser.tenantId);
            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Post épico!');
        });
    });
});
//# sourceMappingURL=social.controller.spec.js.map