import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserContext } from '../../shared/auth/user-context';
import { ClaimRewardUseCase } from '../../rewards/application/use-cases/claim-reward.use-case';
import { GetAvailableRewardsUseCase } from '../../rewards/application/use-cases/get-available-rewards.use-case';
import { RewardClaimTransactionPort } from '../../rewards/application/ports/reward-claim-transaction.port';
import { RewardsEventsPort } from '../../rewards/application/ports/rewards-events.port';
import { RewardsRepositoryPort } from '../../rewards/application/ports/rewards-repository.port';
import { RewardsStatsPort } from '../../rewards/application/ports/rewards-stats.port';
import {
  REWARD_CLAIM_TRANSACTION_PORT,
  REWARDS_EVENTS_PORT,
  REWARDS_REPOSITORY,
  REWARDS_STATS_PORT,
} from '../../rewards/rewards.tokens';

describe('Rewards Use Cases', () => {
  let repository: RewardsRepositoryPort;
  let rewardsStatsPort: RewardsStatsPort;
  let rewardClaimTransactionPort: RewardClaimTransactionPort;
  let rewardsEventsPort: RewardsEventsPort;
  let getAvailableRewardsUseCase: GetAvailableRewardsUseCase;
  let claimRewardUseCase: ClaimRewardUseCase;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' } as UserContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAvailableRewardsUseCase,
        ClaimRewardUseCase,
        {
          provide: REWARDS_REPOSITORY,
          useValue: {
            findAllActiveByTenant: jest.fn(),
            findClaimsByPatient: jest.fn(),
            findById: jest.fn(),
            findSpecificClaim: jest.fn(),
          },
        },
        {
          provide: REWARDS_STATS_PORT,
          useValue: {
            getStats: jest.fn(),
          },
        },
        {
          provide: REWARD_CLAIM_TRANSACTION_PORT,
          useValue: {
            claimReward: jest.fn(),
          },
        },
        {
          provide: REWARDS_EVENTS_PORT,
          useValue: {
            emitRewardClaimed: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    repository = module.get<RewardsRepositoryPort>(REWARDS_REPOSITORY);
    rewardsStatsPort = module.get<RewardsStatsPort>(REWARDS_STATS_PORT);
    rewardClaimTransactionPort = module.get<RewardClaimTransactionPort>(REWARD_CLAIM_TRANSACTION_PORT);
    rewardsEventsPort = module.get<RewardsEventsPort>(REWARDS_EVENTS_PORT);
    getAvailableRewardsUseCase = module.get<GetAvailableRewardsUseCase>(GetAvailableRewardsUseCase);
    claimRewardUseCase = module.get<ClaimRewardUseCase>(ClaimRewardUseCase);
  });

  it('deve mapear recompensas com progresso, status de desbloqueio e resgate', async () => {
    jest.spyOn(rewardsStatsPort, 'getStats').mockResolvedValue({ totalDamage: 500 });
    jest.spyOn(repository, 'findAllActiveByTenant').mockResolvedValue([
      { id: 'r1', requiredDamage: 200 },
      { id: 'r2', requiredDamage: 1000 },
    ] as any);
    jest.spyOn(repository, 'findClaimsByPatient').mockResolvedValue([{ rewardId: 'r1' }] as any);

    const result = await getAvailableRewardsUseCase.execute(mockUser);

    expect(repository.findClaimsByPatient).toHaveBeenCalledWith('u1', 't1');
    expect(result[0].unlocked).toBe(true);
    expect(result[0].claimed).toBe(true);
    expect(result[1].unlocked).toBe(false);
    expect(result[1].progress).toBe(50);
  });

  it('deve lancar BadRequestException se a recompensa nao existir no tenant', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(claimRewardUseCase.execute('invalid-id', mockUser)).rejects.toThrow(
      new BadRequestException('Recompensa não encontrada.'),
    );

    expect(repository.findById).toHaveBeenCalledWith('invalid-id', 't1');
  });

  it('deve lancar BadRequestException se o usuario ja tiver resgatado no tenant', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'r1' } as any);
    jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue({ id: 'claim-1' } as any);

    await expect(claimRewardUseCase.execute('r1', mockUser)).rejects.toThrow(
      new BadRequestException('Você já resgatou esta recompensa!'),
    );

    expect(repository.findSpecificClaim).toHaveBeenCalledWith('r1', 'u1', 't1');
  });

  it('deve delegar o resgate ao adapter transacional e emitir evento', async () => {
    const reward = { id: 'r1', title: 'Premio Epico', requiredDamage: 100, goldCost: 50 };
    jest.spyOn(repository, 'findById').mockResolvedValue(reward as any);
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
