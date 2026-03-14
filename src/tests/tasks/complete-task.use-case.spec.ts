import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { HandleBossVictoryUseCase } from '../../records/application/use-cases/handle-boss-victory.use-case';
import { CompleteTaskUseCase } from '../../tasks/application/use-cases/complete-task.use-case';
import { TaskCompletionTransactionPort } from '../../tasks/application/ports/task-completion-transaction.port';
import { TasksAchievementsPort } from '../../tasks/application/ports/tasks-achievements.port';
import { ITasksRepository } from '../../tasks/application/ports/tasks-repository.port';
import {
  TASK_COMPLETION_TRANSACTION_PORT,
  TASKS_ACHIEVEMENTS_PORT,
  TASKS_REPOSITORY,
} from '../../tasks/tasks.tokens';

describe('CompleteTaskUseCase', () => {
  let useCase: CompleteTaskUseCase;
  let repository: ITasksRepository;
  let transactionPort: TaskCompletionTransactionPort;
  let tasksAchievementsPort: TasksAchievementsPort;
  let handleBossVictoryUseCase: HandleBossVictoryUseCase;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompleteTaskUseCase,
        {
          provide: TASKS_REPOSITORY,
          useValue: {
            findSpecificCompletionToday: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: TASK_COMPLETION_TRANSACTION_PORT,
          useValue: {
            execute: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: TASKS_ACHIEVEMENTS_PORT,
          useValue: {
            checkLevelAchievements: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: HandleBossVictoryUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get<CompleteTaskUseCase>(CompleteTaskUseCase);
    repository = module.get<ITasksRepository>(TASKS_REPOSITORY);
    transactionPort = module.get<TaskCompletionTransactionPort>(TASK_COMPLETION_TRANSACTION_PORT);
    tasksAchievementsPort = module.get<TasksAchievementsPort>(TASKS_ACHIEVEMENTS_PORT);
    handleBossVictoryUseCase = module.get<HandleBossVictoryUseCase>(HandleBossVictoryUseCase);
  });

  it('deve lançar erro se a tarefa já foi completada hoje', async () => {
    jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue({ id: 'comp1' } as any);

    await expect(useCase.execute('task1', mockUser as any)).rejects.toThrow(BadRequestException);
  });

  it('deve lançar erro se a missão não existir', async () => {
    jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue(null);
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(useCase.execute('task-x', mockUser as any)).rejects.toThrow(BadRequestException);
  });

  it('deve processar a conclusão com sucesso e dar dano no boss', async () => {
    jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue(null);
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'task1', xpReward: 50 } as any);
    jest.spyOn(transactionPort, 'execute').mockResolvedValue({
      newXp: 100,
      newLevel: 1,
      leveledUp: false,
      bossDamage: 50,
    });

    const result = await useCase.execute('task1', mockUser as any);

    expect(result.success).toBe(true);
    expect(result.xp_earned).toBe(50);
    expect(result.boss_damage).toBe(50);
  });

  it('deve subir de nível e disparar conquistas quando o XP atinge o limite', async () => {
    jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue(null);
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 't1', xpReward: 1000 } as any);
    jest.spyOn(transactionPort, 'execute').mockResolvedValue({
      newXp: 1050,
      newLevel: 2,
      leveledUp: true,
      bossDamage: 1000,
    });

    const result = await useCase.execute('t1', mockUser as any);

    expect(result.level_up).toBe(true);
    expect(tasksAchievementsPort.checkLevelAchievements).toHaveBeenCalledWith({
      patientId: mockUser.userId,
      tenantId: mockUser.tenantId,
      newLevel: 2,
    });
  });

  it('deve disparar o use case de vitória quando a transação indicar boss derrotado', async () => {
    jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue(null);
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'task-id', xpReward: 100 } as any);
    jest.spyOn(transactionPort, 'execute').mockResolvedValue({
      newXp: 100,
      newLevel: 1,
      leveledUp: false,
      bossDamage: 100,
      defeatedBossId: 'boss-1',
    });

    await useCase.execute('task-id', mockUser as any);

    expect(handleBossVictoryUseCase.execute).toHaveBeenCalledWith('boss-1', mockUser.tenantId);
  });
});
