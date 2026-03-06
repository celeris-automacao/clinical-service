// src/tests/rewards/rewards.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RewardsController } from '../../rewards/rewards.controller';
import { RewardsService } from '../../rewards/rewards.service';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';

describe('RewardsController', () => {
  let controller: RewardsController;
  let service: RewardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RewardsController],
      providers: [
        {
          provide: RewardsService,
          useValue: { getAvailableRewards: jest.fn(), claimReward: jest.fn() },
        },
      ],
    })
      .overrideGuard(SupabaseGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RewardsController>(RewardsController);
    service = module.get<RewardsService>(RewardsService);
  });

  it('getAvailable deve repassar o usuário logado para o serviço', async () => {
    const mockUser = { userId: 'u1' };
    await controller.getAvailable(mockUser as any);
    expect(service.getAvailableRewards).toHaveBeenCalledWith(mockUser);
  });
});