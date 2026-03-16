"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const claim_reward_use_case_1 = require("../../rewards/application/use-cases/claim-reward.use-case");
const create_reward_use_case_1 = require("../../rewards/application/use-cases/create-reward.use-case");
const get_available_rewards_use_case_1 = require("../../rewards/application/use-cases/get-available-rewards.use-case");
const rewards_controller_1 = require("../../rewards/presentation/http/rewards.controller");
describe('RewardsController', () => {
    let controller;
    let createRewardUseCase;
    let getAvailableRewardsUseCase;
    let claimRewardUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [rewards_controller_1.RewardsController],
            providers: [
                {
                    provide: create_reward_use_case_1.CreateRewardUseCase,
                    useValue: { execute: jest.fn() },
                },
                {
                    provide: get_available_rewards_use_case_1.GetAvailableRewardsUseCase,
                    useValue: { execute: jest.fn() },
                },
                {
                    provide: claim_reward_use_case_1.ClaimRewardUseCase,
                    useValue: { execute: jest.fn() },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(roles_guard_1.RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(rewards_controller_1.RewardsController);
        createRewardUseCase = module.get(create_reward_use_case_1.CreateRewardUseCase);
        getAvailableRewardsUseCase = module.get(get_available_rewards_use_case_1.GetAvailableRewardsUseCase);
        claimRewardUseCase = module.get(claim_reward_use_case_1.ClaimRewardUseCase);
    });
    it('create deve repassar dto e tenant do usuario para o use case', async () => {
        const mockUser = { userId: 'u1', tenantId: 't1' };
        const dto = { title: 'Cupom', requiredDamage: 100, goldCost: 10 };
        await controller.create(dto, mockUser);
        expect(createRewardUseCase.execute).toHaveBeenCalledWith(dto, 't1');
    });
    it('getAvailable deve repassar o usuario logado para o use case', async () => {
        const mockUser = { userId: 'u1' };
        await controller.getAvailable(mockUser);
        expect(getAvailableRewardsUseCase.execute).toHaveBeenCalledWith(mockUser);
    });
    it('claim deve repassar rewardId e usuario logado para o use case', async () => {
        const mockUser = { userId: 'u1' };
        await controller.claim('reward-1', mockUser);
        expect(claimRewardUseCase.execute).toHaveBeenCalledWith('reward-1', mockUser);
    });
});
//# sourceMappingURL=rewards.controller.spec.js.map