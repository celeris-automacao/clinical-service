"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
const social_controller_1 = require("../../social/presentation/http/social.controller");
const get_feed_use_case_1 = require("../../social/application/use-cases/get-feed.use-case");
describe('SocialController', () => {
    let controller;
    let getFeedUseCase;
    const mockUser = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        role: 'patient',
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [social_controller_1.SocialController],
            providers: [
                {
                    provide: get_feed_use_case_1.GetFeedUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue([{ id: '1', content: 'Post épico!' }]),
                    },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(social_controller_1.SocialController);
        getFeedUseCase = module.get(get_feed_use_case_1.GetFeedUseCase);
    });
    it('deve chamar o use case com o tenantId do usuário logado', async () => {
        const result = await controller.getFeed(mockUser);
        expect(getFeedUseCase.execute).toHaveBeenCalledWith(mockUser.tenantId);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Post épico!');
    });
});
//# sourceMappingURL=social.controller.spec.js.map