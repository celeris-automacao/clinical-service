import { Test, TestingModule } from '@nestjs/testing';
import { TenantScopedPrismaFactory } from '../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PrismaTasksRepository } from '../../tasks/infrastructure/persistence/prisma-tasks.repository';

describe('PrismaTasksRepository', () => {
  let repository: PrismaTasksRepository;
  let tenantScopedPrismaFactory: TenantScopedPrismaFactory;

  const rootPrisma = {
    taskCompletion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const tenantPrisma = {
    dailyTask: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    playerStats: {
      findMany: jest.fn(),
    },
    patient: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTasksRepository,
        {
          provide: TenantScopedPrismaFactory,
          useValue: {
            forRoot: jest.fn().mockReturnValue(rootPrisma),
            forTenant: jest.fn().mockReturnValue(tenantPrisma),
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaTasksRepository>(PrismaTasksRepository);
    tenantScopedPrismaFactory = module.get<TenantScopedPrismaFactory>(TenantScopedPrismaFactory);
  });

  it('deve buscar tarefas ativas filtrando pelo tenantId', async () => {
    await repository.findTasksByTenant('tenant-123');

    expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-123');
    expect(tenantPrisma.dailyTask.findMany).toHaveBeenCalledWith({
      where: { isCompleted: true, tenantId: 'tenant-123' },
    });
  });

  it('deve buscar conclusoes do paciente a partir do inicio do dia', async () => {
    const startOfDay = new Date('2026-03-03T00:00:00Z');

    await repository.findCompletionsByPatientToday('user-1', startOfDay);

    expect(rootPrisma.taskCompletion.findMany).toHaveBeenCalledWith({
      where: {
        patientId: 'user-1',
        completedAt: { gte: startOfDay },
      },
    });
  });

  it('deve verificar se uma tarefa especifica foi concluida no intervalo', async () => {
    const start = new Date('2026-03-03T00:00:00Z');
    const end = new Date('2026-03-03T23:59:59Z');

    await repository.findSpecificCompletionToday('task-1', 'user-1', start, end);

    expect(rootPrisma.taskCompletion.findFirst).toHaveBeenCalledWith({
      where: {
        taskId: 'task-1',
        patientId: 'user-1',
        completedAt: { gte: start, lte: end },
      },
    });
  });

  it('deve buscar uma tarefa pelo id dentro do tenant', async () => {
    await repository.findById('task-1', 'tenant-1');

    expect(tenantPrisma.dailyTask.findFirst).toHaveBeenCalledWith({
      where: { id: 'task-1', tenantId: 'tenant-1' },
    });
  });

  it('deve buscar tarefas pendentes de hoje filtrando por tenant', async () => {
    const today = new Date('2026-03-03');

    await repository.findPendingTasksToday('user-1', 'tenant-1', today);

    expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-1', 'user-1');
    expect(tenantPrisma.dailyTask.findMany).toHaveBeenCalledWith({
      where: {
        patientId: 'user-1',
        tenantId: 'tenant-1',
        isCompleted: false,
        dueDate: today,
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('deve buscar o ranking filtrando por tenant', async () => {
    await repository.getPlayerStatsRanking('tenant-1');

    expect(tenantPrisma.playerStats.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: {
        currentLevel: true,
        currentXp: true,
        totalDamageDealt: true,
        patient: { select: { name: true } },
      },
      orderBy: [{ currentLevel: 'desc' }, { currentXp: 'desc' }, { totalDamageDealt: 'desc' }],
    });
  });
});
