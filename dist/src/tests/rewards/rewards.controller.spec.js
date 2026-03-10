"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const rewards_controller_1 = require("../../rewards/rewards.controller");
const rewards_service_1 = require("../../rewards/rewards.service");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
describe('RewardsController', () => {
    let controller;
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [rewards_controller_1.RewardsController],
            providers: [
                {
                    provide: rewards_service_1.RewardsService,
                    useValue: { getAvailableRewards: jest.fn(), claimReward: jest.fn() },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard).useValue({ canActivate: () => true })
            .compile();
        controller = module.get(rewards_controller_1.RewardsController);
        service = module.get(rewards_service_1.RewardsService);
    });
    it('getAvailable deve repassar o usuário logado para o serviço', async () => {
        const mockUser = { userId: 'u1' };
        await controller.getAvailable(mockUser);
        expect(service.getAvailableRewards).toHaveBeenCalledWith(mockUser);
    });
});
//# sourceMappingURL=rewards.controller.spec.js.map