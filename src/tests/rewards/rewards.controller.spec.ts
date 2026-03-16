import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClaimRewardUseCase } from '../../rewards/application/use-cases/claim-reward.use-case';
import { CreateRewardUseCase } from '../../rewards/application/use-cases/create-reward.use-case';
import { GetAvailableRewardsUseCase } from '../../rewards/application/use-cases/get-available-rewards.use-case';
import { RewardsController } from '../../rewards/presentation/http/rewards.controller';

describe('RewardsController', () => {
  let controller: RewardsController;
  let createRewardUseCase: CreateRewardUseCase;
  let getAvailableRewardsUseCase: GetAvailableRewardsUseCase;
  let claimRewardUseCase: ClaimRewardUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RewardsController],
      providers: [
        {
          provide: CreateRewardUseCase,
          useValue: { execute: jest.fn() },
        },
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
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RewardsController>(RewardsController);
    createRewardUseCase = module.get<CreateRewardUseCase>(CreateRewardUseCase);
    getAvailableRewardsUseCase = module.get<GetAvailableRewardsUseCase>(GetAvailableRewardsUseCase);
    claimRewardUseCase = module.get<ClaimRewardUseCase>(ClaimRewardUseCase);
  });

  it('create deve repassar dto e tenant do usuario para o use case', async () => {
    const mockUser = { userId: 'u1', tenantId: 't1' };
    const dto = { title: 'Cupom', requiredDamage: 100, goldCost: 10 };

    await controller.create(dto as any, mockUser as any);

    expect(createRewardUseCase.execute).toHaveBeenCalledWith(dto, 't1');
  });

  it('getAvailable deve repassar o usuario logado para o use case', async () => {
    const mockUser = { userId: 'u1' };
    await controller.getAvailable(mockUser as any);
    expect(getAvailableRewardsUseCase.execute).toHaveBeenCalledWith(mockUser);
  });

  it('claim deve repassar rewardId e usuario logado para o use case', async () => {
    const mockUser = { userId: 'u1' };
    await controller.claim('reward-1', mockUser as any);
    expect(claimRewardUseCase.execute).toHaveBeenCalledWith('reward-1', mockUser);
  });
});
