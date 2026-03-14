import { Test, TestingModule } from '@nestjs/testing';
import { TenantScopedPrismaFactory } from '../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PrismaTaskCompletionTransactionAdapter } from '../../tasks/infrastructure/persistence/prisma-task-completion-transaction.adapter';

describe('PrismaTaskCompletionTransactionAdapter', () => {
  let adapter: PrismaTaskCompletionTransactionAdapter;
  let tenantScopedPrismaFactory: TenantScopedPrismaFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTaskCompletionTransactionAdapter,
        {
          provide: TenantScopedPrismaFactory,
          useValue: {
            runInTenantTransaction: jest.fn(),
          },
        },
      ],
    }).compile();

    adapter = module.get<PrismaTaskCompletionTransactionAdapter>(PrismaTaskCompletionTransactionAdapter);
    tenantScopedPrismaFactory = module.get<TenantScopedPrismaFactory>(TenantScopedPrismaFactory);
  });

  it('deve concluir a tarefa, atualizar progressao e aplicar dano normal ao boss', async () => {
    const tx = {
      taskCompletion: { create: jest.fn() },
      playerStats: {
        upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 50 }),
        update: jest.fn(),
      },
      bossBattle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'boss-1', currentHp: 1000 }),
        update: jest.fn(),
      },
    };

    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context, callback) => callback(tx as any),
    );

    const result = await adapter.execute({
      taskId: 'task-1',
      patientId: 'user-1',
      tenantId: 'tenant-1',
      xpReward: 50,
    });

    expect(tenantScopedPrismaFactory.runInTenantTransaction).toHaveBeenCalledWith(
      { userId: 'user-1', tenantId: 'tenant-1' },
      expect.any(Function),
    );
    expect(tx.taskCompletion.create).toHaveBeenCalled();
    expect(tx.playerStats.upsert).toHaveBeenCalled();
    expect(tx.playerStats.update).toHaveBeenCalled();
    expect(tx.bossBattle.update).toHaveBeenCalledWith({
      where: { id: 'boss-1' },
      data: { currentHp: 950 },
    });
    expect(result.bossDamage).toBe(50);
    expect(result.defeatedBossId).toBeUndefined();
  });

  it('deve retornar boss derrotado sem atualizar hp quando o dano zerar a vida', async () => {
    const tx = {
      taskCompletion: { create: jest.fn() },
      playerStats: {
        upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 0 }),
        update: jest.fn(),
      },
      bossBattle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'boss-1', currentHp: 50 }),
        update: jest.fn(),
      },
    };

    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context, callback) => callback(tx as any),
    );

    const result = await adapter.execute({
      taskId: 'task-1',
      patientId: 'user-1',
      tenantId: 'tenant-1',
      xpReward: 100,
    });

    expect(tx.bossBattle.update).not.toHaveBeenCalled();
    expect(result.bossDamage).toBe(100);
    expect(result.defeatedBossId).toBe('boss-1');
  });

  it('deve retornar dano zero se nao houver boss ativo', async () => {
    const tx = {
      taskCompletion: { create: jest.fn() },
      playerStats: {
        upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 0 }),
        update: jest.fn(),
      },
      bossBattle: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };

    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context, callback) => callback(tx as any),
    );

    const result = await adapter.execute({
      taskId: 'task-1',
      patientId: 'user-1',
      tenantId: 'tenant-1',
      xpReward: 100,
    });

    expect(result.bossDamage).toBe(0);
    expect(result.defeatedBossId).toBeUndefined();
  });
});
