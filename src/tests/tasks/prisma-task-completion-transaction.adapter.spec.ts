import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTaskCompletionTransactionAdapter } from '../../tasks/infrastructure/persistence/prisma-task-completion-transaction.adapter';

describe('PrismaTaskCompletionTransactionAdapter', () => {
  let adapter: PrismaTaskCompletionTransactionAdapter;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTaskCompletionTransactionAdapter,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    adapter = module.get<PrismaTaskCompletionTransactionAdapter>(PrismaTaskCompletionTransactionAdapter);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve concluir a tarefa, atualizar progressão e aplicar dano normal ao boss', async () => {
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

    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb) => cb(tx as any));

    const result = await adapter.execute({
      taskId: 'task-1',
      patientId: 'user-1',
      tenantId: 'tenant-1',
      xpReward: 50,
    });

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

    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb) => cb(tx as any));

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

  it('deve retornar dano zero se não houver boss ativo', async () => {
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

    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb) => cb(tx as any));

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
