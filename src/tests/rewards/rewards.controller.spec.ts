import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { RewardsController } from '../../rewards/rewards.controller';
import { ClaimRewardUseCase } from '../../rewards/application/use-cases/claim-reward.use-case';
import { GetAvailableRewardsUseCase } from '../../rewards/application/use-cases/get-available-rewards.use-case';

describe('RewardsController', () => {
  let controller: RewardsController;
  let getAvailableRewardsUseCase: GetAvailableRewardsUseCase;
  let claimRewardUseCase: ClaimRewardUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RewardsController],
      providers: [
        {
          provide: GetAvailableRewardsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ClaimRewardUseCase,
          useValue: { execute: jest.fn() },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RewardsController>(RewardsController);
    getAvailableRewardsUseCase = module.get<GetAvailableRewardsUseCase>(GetAvailableRewardsUseCase);
    claimRewardUseCase = module.get<ClaimRewardUseCase>(ClaimRewardUseCase);
  });

  it('getAvailable deve repassar o usuário logado para o use case', async () => {
    const mockUser = { userId: 'u1' };
    await controller.getAvailable(mockUser as any);
    expect(getAvailableRewardsUseCase.execute).toHaveBeenCalledWith(mockUser);
  });

  it('claim deve repassar rewardId e usuário logado para o use case', async () => {
    const mockUser = { userId: 'u1' };
    await controller.claim('reward-1', mockUser as any);
    expect(claimRewardUseCase.execute).toHaveBeenCalledWith('reward-1', mockUser);
  });
});
