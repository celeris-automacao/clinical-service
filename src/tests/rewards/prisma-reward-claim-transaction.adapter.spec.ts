import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantScopedPrismaFactory } from '../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PrismaRewardClaimTransactionAdapter } from '../../rewards/infrastructure/persistence/prisma-reward-claim-transaction.adapter';

describe('PrismaRewardClaimTransactionAdapter', () => {
  let adapter: PrismaRewardClaimTransactionAdapter;
  let tenantScopedPrismaFactory: TenantScopedPrismaFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaRewardClaimTransactionAdapter,
        {
          provide: TenantScopedPrismaFactory,
          useValue: {
            runInTenantTransaction: jest.fn(),
          },
        },
      ],
    }).compile();

    adapter = module.get<PrismaRewardClaimTransactionAdapter>(PrismaRewardClaimTransactionAdapter);
    tenantScopedPrismaFactory = module.get<TenantScopedPrismaFactory>(TenantScopedPrismaFactory);
  });

  it('deve lancar erro se o perfil do jogador nao existir', async () => {
    const tx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context, callback) => callback(tx as any),
    );

    await expect(
      adapter.claimReward({
        rewardId: 'r1',
        patientId: 'u1',
        tenantId: 't1',
        requiredDamage: 100,
        goldCost: 50,
      }),
    ).rejects.toThrow(new BadRequestException('Perfil do jogador nao encontrado.'));
  });

  it('deve lancar erro se o dano for insuficiente', async () => {
    const tx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 20, currentGold: 500 }),
      },
    };
    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context, callback) => callback(tx as any),
    );

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

  it('deve lancar erro se o ouro for insuficiente', async () => {
    const tx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 1000, currentGold: 20 }),
      },
    };
    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context, callback) => callback(tx as any),
    );

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

  it('deve atualizar ouro e criar o reward claim dentro da transacao', async () => {
    const tx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 1000, currentGold: 200 }),
        update: jest.fn().mockResolvedValue({}),
      },
      rewardClaim: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context, callback) => callback(tx as any),
    );

    const result = await adapter.claimReward({
      rewardId: 'r1',
      patientId: 'u1',
      tenantId: 't1',
      requiredDamage: 100,
      goldCost: 50,
    });

    expect(tenantScopedPrismaFactory.runInTenantTransaction).toHaveBeenCalledWith(
      { userId: 'u1', tenantId: 't1' },
      expect.any(Function),
    );
    expect(tx.playerStats.update).toHaveBeenCalledWith({
      where: { patientId: 'u1' },
      data: { currentGold: { decrement: 50 } },
    });
    expect(tx.rewardClaim.create).toHaveBeenCalledWith({
      data: {
        rewardId: 'r1',
        patientId: 'u1',
        tenantId: 't1',
      },
    });
    expect(result).toEqual({ remainingGold: 150 });
  });
});
