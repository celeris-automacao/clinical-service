import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaRewardClaimTransactionAdapter } from '../../rewards/infrastructure/persistence/prisma-reward-claim-transaction.adapter';

describe('PrismaRewardClaimTransactionAdapter', () => {
  let adapter: PrismaRewardClaimTransactionAdapter;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaRewardClaimTransactionAdapter,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) =>
              cb({
                playerStats: {
                  findUnique: jest.fn(),
                  update: jest.fn().mockResolvedValue({}),
                },
                rewardClaim: {
                  create: jest.fn().mockResolvedValue({}),
                },
              } as any),
            ),
          },
        },
      ],
    }).compile();

    adapter = module.get<PrismaRewardClaimTransactionAdapter>(PrismaRewardClaimTransactionAdapter);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve lançar erro se o perfil do jogador não existir', async () => {
    const mockTx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

    await expect(
      adapter.claimReward({
        rewardId: 'r1',
        patientId: 'u1',
        tenantId: 't1',
        requiredDamage: 100,
        goldCost: 50,
      }),
    ).rejects.toThrow(new BadRequestException('Perfil do jogador não encontrado.'));
  });

  it('deve lançar erro se o dano for insuficiente', async () => {
    const mockTx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 20, currentGold: 500 }),
      },
    };
    jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

    await expect(
      adapter.claimReward({
        rewardId: 'r1',
        patientId: 'u1',
        tenantId: 't1',
        requiredDamage: 100,
        goldCost: 50,
      }),
    ).rejects.toThrow(new BadRequestException('Dano total insuficiente para desbloquear.'));
  });

  it('deve lançar erro se o ouro for insuficiente', async () => {
    const mockTx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 1000, currentGold: 20 }),
      },
    };
    jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

    await expect(
      adapter.claimReward({
        rewardId: 'r1',
        patientId: 'u1',
        tenantId: 't1',
        requiredDamage: 100,
        goldCost: 50,
      }),
    ).rejects.toThrow(/Saldo insuficiente/);
  });

  it('deve atualizar ouro e criar o reward claim dentro da transação', async () => {
    const mockTx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 1000, currentGold: 200 }),
        update: jest.fn().mockResolvedValue({}),
      },
      rewardClaim: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

    const result = await adapter.claimReward({
      rewardId: 'r1',
      patientId: 'u1',
      tenantId: 't1',
      requiredDamage: 100,
      goldCost: 50,
    });

    expect(mockTx.playerStats.update).toHaveBeenCalledWith({
      where: { patientId: 'u1' },
      data: { currentGold: { decrement: 50 } },
    });
    expect(mockTx.rewardClaim.create).toHaveBeenCalledWith({
      data: {
        rewardId: 'r1',
        patientId: 'u1',
        tenantId: 't1',
      },
    });
    expect(result).toEqual({ remainingGold: 150 });
  });
});
