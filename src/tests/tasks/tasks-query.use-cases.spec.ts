import { Test, TestingModule } from '@nestjs/testing';
import { IRecordsRepository } from '../../records/repositories/interfaces/records.repository.interface';
import { GetCategorizedRankingUseCase } from '../../tasks/application/use-cases/get-categorized-ranking.use-case';
import { GetDailyTasksUseCase } from '../../tasks/application/use-cases/get-daily-tasks.use-case';
import { GetRankingUseCase } from '../../tasks/application/use-cases/get-ranking.use-case';
import { GetTasksTodayUseCase } from '../../tasks/application/use-cases/get-tasks-today.use-case';
import { ITasksRepository } from '../../tasks/repositories/interfaces/tasks.repository.interface';
import { TASKS_REPOSITORY } from '../../tasks/tasks.tokens';

describe('Tasks Query Use Cases', () => {
  let tasksRepository: ITasksRepository;
  let recordsRepository: IRecordsRepository;
  let getDailyTasksUseCase: GetDailyTasksUseCase;
  let getRankingUseCase: GetRankingUseCase;
  let getCategorizedRankingUseCase: GetCategorizedRankingUseCase;
  let getTasksTodayUseCase: GetTasksTodayUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetDailyTasksUseCase,
        GetRankingUseCase,
        GetCategorizedRankingUseCase,
        GetTasksTodayUseCase,
        {
          provide: TASKS_REPOSITORY,
          useValue: {
            findTasksByTenant: jest.fn(),
            findCompletionsByPatientToday: jest.fn(),
            getPlayerStatsRanking: jest.fn(),
            findPendingTasksToday: jest.fn(),
            findPatientsWithActivity: jest.fn(),
          },
        },
        {
          provide: 'IRecordsRepository',
          useValue: {
            getClinicalDamageByTenant: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();

    tasksRepository = module.get<ITasksRepository>(TASKS_REPOSITORY);
    recordsRepository = module.get<IRecordsRepository>('IRecordsRepository');
    getDailyTasksUseCase = module.get<GetDailyTasksUseCase>(GetDailyTasksUseCase);
    getRankingUseCase = module.get<GetRankingUseCase>(GetRankingUseCase);
    getCategorizedRankingUseCase = module.get<GetCategorizedRankingUseCase>(GetCategorizedRankingUseCase);
    getTasksTodayUseCase = module.get<GetTasksTodayUseCase>(GetTasksTodayUseCase);
  });

  it('deve listar as tarefas do tenant e marcar corretamente as que o usuário já completou hoje', async () => {
    const mockUser = { userId: 'u1', tenantId: 't1' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mockTasks = [
      { id: 'task-1', title: 'Beber Água' },
      { id: 'task-2', title: 'Caminhada' },
    ];
    const mockCompletions = [{ taskId: 'task-1', patientId: 'u1' }];

    jest.spyOn(tasksRepository, 'findTasksByTenant').mockResolvedValue(mockTasks as any);
    jest.spyOn(tasksRepository, 'findCompletionsByPatientToday').mockResolvedValue(mockCompletions as any);

    const result = await getDailyTasksUseCase.execute(mockUser as any);

    expect(result).toHaveLength(2);
    expect(result[0].completed).toBe(true);
    expect(result[1].completed).toBe(false);
    expect(tasksRepository.findCompletionsByPatientToday).toHaveBeenCalledWith('u1', today);
  });

  it('deve mapear corretamente o ranking global e atribuir posições', async () => {
    const mockUser = { tenantId: 'tenant-123' };
    const mockPlayerStats = [
      {
        patient: { name: 'João Silva' },
        currentLevel: 10,
        currentXp: 500,
        totalDamageDealt: 15000,
      },
      {
        patient: null,
        currentLevel: 5,
        currentXp: 100,
        totalDamageDealt: 5000,
      },
    ];

    jest.spyOn(tasksRepository, 'getPlayerStatsRanking').mockResolvedValue(mockPlayerStats as any);

    const result = await getRankingUseCase.execute(mockUser as any);

    expect(result).toHaveLength(2);
    expect(result[0].position).toBe(1);
    expect(result[0].name).toBe('João Silva');
    expect(result[1].position).toBe(2);
    expect(result[1].name).toBe('Herói Anônimo');
    expect(result[1].damage).toBe(5000);
  });

  it('deve retornar o ranking categorizado integrando dano de tarefas e clínico', async () => {
    const tenantId = 't1';
    const mockPatients = [{ id: 'p1', name: 'Paciente A', completions: [{ task: { xpReward: 1000 } }] }];
    const mockClinicalDamageMap = new Map<string, number>();
    mockClinicalDamageMap.set('p1', 7700);

    jest.spyOn(tasksRepository, 'findPatientsWithActivity').mockResolvedValue(mockPatients as any);
    jest.spyOn(recordsRepository, 'getClinicalDamageByTenant').mockResolvedValue(mockClinicalDamageMap);

    const result = await getCategorizedRankingUseCase.execute(tenantId);

    expect(result[0].name).toBe('Paciente A');
    expect(result[0].missionRank).toBe(1000);
    expect(result[0].clinicalRank).toBe(7700);
    expect(result[0].totalDamage).toBe(8700);
  });

  it('deve buscar as tarefas pendentes de hoje com as horas resetadas para meia-noite', async () => {
    const mockUser = { userId: 'user-789', tenantId: 'tenant-456' };
    const mockPendingTasks = [
      { id: 'task-1', title: 'Caminhada Matinal', xpReward: 500 },
      { id: 'task-2', title: 'Beber 2L de Água', xpReward: 200 },
    ];

    jest.spyOn(tasksRepository, 'findPendingTasksToday').mockResolvedValue(mockPendingTasks as any);

    const result = await getTasksTodayUseCase.execute(mockUser as any);

    const expectedDate = new Date();
    expectedDate.setHours(0, 0, 0, 0);

    expect(tasksRepository.findPendingTasksToday).toHaveBeenCalledWith(
      mockUser.userId,
      mockUser.tenantId,
      expectedDate,
    );
    expect(result).toEqual(mockPendingTasks);
    expect(result).toHaveLength(2);
  });
});
