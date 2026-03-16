"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const claim_reward_use_case_1 = require("../../rewards/application/use-cases/claim-reward.use-case");
const get_available_rewards_use_case_1 = require("../../rewards/application/use-cases/get-available-rewards.use-case");
const rewards_tokens_1 = require("../../rewards/rewards.tokens");
describe('Rewards Use Cases', () => {
    let repository;
    let rewardsStatsPort;
    let rewardClaimTransactionPort;
    let rewardsEventsPort;
    let getAvailableRewardsUseCase;
    let claimRewardUseCase;
    const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                get_available_rewards_use_case_1.GetAvailableRewardsUseCase,
                claim_reward_use_case_1.ClaimRewardUseCase,
                {
                    provide: rewards_tokens_1.REWARDS_REPOSITORY,
                    useValue: {
                        findAllActiveByTenant: jest.fn(),
                        findClaimsByPatient: jest.fn(),
                        findById: jest.fn(),
                        findSpecificClaim: jest.fn(),
                    },
                },
                {
                    provide: rewards_tokens_1.REWARDS_STATS_PORT,
                    useValue: {
                        getStats: jest.fn(),
                    },
                },
                {
                    provide: rewards_tokens_1.REWARD_CLAIM_TRANSACTION_PORT,
                    useValue: {
                        claimReward: jest.fn(),
                    },
                },
                {
                    provide: rewards_tokens_1.REWARDS_EVENTS_PORT,
                    useValue: {
                        emitRewardClaimed: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();
        repository = module.get(rewards_tokens_1.REWARDS_REPOSITORY);
        rewardsStatsPort = module.get(rewards_tokens_1.REWARDS_STATS_PORT);
        rewardClaimTransactionPort = module.get(rewards_tokens_1.REWARD_CLAIM_TRANSACTION_PORT);
        rewardsEventsPort = module.get(rewards_tokens_1.REWARDS_EVENTS_PORT);
        getAvailableRewardsUseCase = module.get(get_available_rewards_use_case_1.GetAvailableRewardsUseCase);
        claimRewardUseCase = module.get(claim_reward_use_case_1.ClaimRewardUseCase);
    });
    it('deve mapear recompensas com progresso, status de desbloqueio e resgate', async () => {
        jest.spyOn(rewardsStatsPort, 'getStats').mockResolvedValue({ totalDamage: 500 });
        jest.spyOn(repository, 'findAllActiveByTenant').mockResolvedValue([
            { id: 'r1', requiredDamage: 200 },
            { id: 'r2', requiredDamage: 1000 },
        ]);
        jest.spyOn(repository, 'findClaimsByPatient').mockResolvedValue([{ rewardId: 'r1' }]);
        const result = await getAvailableRewardsUseCase.execute(mockUser);
        expect(repository.findClaimsByPatient).toHaveBeenCalledWith('u1', 't1');
        expect(result[0].unlocked).toBe(true);
        expect(result[0].claimed).toBe(true);
        expect(result[1].unlocked).toBe(false);
        expect(result[1].progress).toBe(50);
    });
    it('deve lancar BadRequestException se a recompensa nao existir no tenant', async () => {
        jest.spyOn(repository, 'findById').mockResolvedValue(null);
        await expect(claimRewardUseCase.execute('invalid-id', mockUser)).rejects.toThrow(new common_1.BadRequestException('Recompensa não encontrada.'));
        expect(repository.findById).toHaveBeenCalledWith('invalid-id', 't1');
    });
    it('deve lancar BadRequestException se o usuario ja tiver resgatado no tenant', async () => {
        jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'r1' });
        jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue({ id: 'claim-1' });
        await expect(claimRewardUseCase.execute('r1', mockUser)).rejects.toThrow(new common_1.BadRequestException('Você já resgatou esta recompensa!'));
        expect(repository.findSpecificClaim).toHaveBeenCalledWith('r1', 'u1', 't1');
    });
    it('deve delegar o resgate ao adapter transacional e emitir evento', async () => {
        const reward = { id: 'r1', title: 'Premio Epico', requiredDamage: 100, goldCost: 50 };
        jest.spyOn(repository, 'findById').mockResolvedValue(reward);
        jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue(null);
        jest.spyOn(rewardClaimTransactionPort, 'claimReward').mockResolvedValue({ remainingGold: 950 });
        const result = await claimRewardUseCase.execute('r1', mockUser);
        expect(repository.findById).toHaveBeenCalledWith('r1', 't1');
        expect(repository.findSpecificClaim).toHaveBeenCalledWith('r1', 'u1', 't1');
        expect(rewardClaimTransactionPort.claimReward).toHaveBeenCalledWith({
            rewardId: 'r1',
            patientId: mockUser.userId,
            tenantId: mockUser.tenantId,
            requiredDamage: 100,
            goldCost: 50,
        });
        expect(rewardsEventsPort.emitRewardClaimed).toHaveBeenCalledWith({
            userId: mockUser.userId,
            tenantId: mockUser.tenantId,
            achievement: 'Premio Epico',
        });
        expect(result).toEqual({ success: true, remainingGold: 950 });
    });
});
//# sourceMappingURL=rewards.use-cases.spec.js.map